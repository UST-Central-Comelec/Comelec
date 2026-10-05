"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor, type PortalUser } from "@/lib/auth/session";
import { countChanges, totalChanges } from "@/lib/codes/diff";
import { approvalRequestEmail, revisionPublishedEmail, revisionReturnedEmail, revisionSignedEmail, revisionSubmittedEmail, revisionWithdrawnEmail } from "@/lib/codes/emails";
import { approverRoleOf, approverRoles, canEditCodes, codes, isCodeKey, type CodeKey, type RevisionEvent, type RevisionPerson, type RevisionSummary } from "@/lib/codes/options";
import { RevisionOpenError, changeRevision, createRevision, getOpenRevision, getPublishedCode, getRevisionSummary, isCodesMissing, listApprovers } from "@/lib/codes/store";
import { articlesSchema, hasUniqueAnchors, problemsIn, tidyArticles } from "@/lib/codes/text";
import { describeRole, properName } from "@/lib/data/accounts";
import { emailCentral, later, sendAutomatic } from "@/lib/notifications/notify";
import { tabHref } from "./access";
import { text, type FormState } from "./form";

// Publications → Constitution and Elections Code, and Apps → Approvals: writing a revision, sending
// it for approval, and signing it or sending it back.
//
// Every step is emailed to the Central Comelec, whose texts these are: its official account and its
// Executive Board, with the revision's editors (followersOf). Nobody Local is told.
//
// Two rules sit on top of the tabs. Only the Central Comelec's Legal Head, its Secretary to the
// Adjudicatory and their offices' Executive Associates write (canEditCodes); only its Chairperson,
// Vice Chairperson and Secretary to the Executive sign (approverRoleOf). Both are checked here,
// whatever the page showed. Everything bound to an action is checked again, since bound values
// come back from the browser.

/**
 * What saving a draft answers with. `saved` is the draft as it now stands, for the editor to carry
 * on from; it comes with an `error` when the draft was saved but couldn't be sent for approval, and
 * `problems` lists what's in the way.
 */
export type CodeFormState = { error?: string; problems?: string[]; saved?: { id: string; edits: number; at: string } } | undefined;

/** Where an approver came from, to go back to: the Approvals tab, or the text's own tab. */
export type ReviewPlace = "approvals" | "tab";

const MAX_SUMMARY = 2000;
const MIGRATION = "supabase/migrations/0025_code_revisions.sql";

const pageOf = (code: CodeKey) => tabHref(codes[code].tab);
const revisionPage = (revision: Pick<RevisionSummary, "id" | "code">, place: ReviewPlace = "tab") => (place === "approvals" ? `/portal/apps/approvals/${revision.id}` : `${pageOf(revision.code)}/revisions/${revision.id}`);

/** The signed-in account, if it's one that writes the texts. Anyone else lands back on the tab. */
async function requireCodeEditor(code: CodeKey) {
  const user = await requireEditor(codes[code].tab);
  if (!canEditCodes(user)) redirect(pageOf(code));
  return user;
}

/** The signed-in account, if it's one of the three who sign. */
async function requireApprover() {
  const user = await requireEditor("apps/approvals");
  if (!approverRoleOf(user)) redirect(tabHref("apps/approvals"));
  return user;
}

/** Someone as a revision's history names them: "Juan Dela Cruz", "Legal Head". */
const personOf = (user: PortalUser): RevisionPerson => ({ name: properName(user.name), email: user.email, role: describeRole(user) });

const eventBy = (person: RevisionPerson, action: RevisionEvent["action"], at: string, note?: string): RevisionEvent => ({ at, action, name: person.name, role: person.role, ...(note && { note }) });

/** The website's page for the text, and every portal page: lists, the dashboard and the pages themselves follow a change. */
function refresh(code: CodeKey, published = false) {
  if (published) revalidatePath(codes[code].path);
  revalidatePath("/portal", "layout");
}

function saveError(error: unknown): CodeFormState {
  if (error instanceof RevisionOpenError) return { error: "Someone else started a revision of this text just now, so yours wasn’t saved. Copy anything you need from here, then reload to carry on from theirs." };
  const message = error instanceof Error ? error.message : String(error);
  console.error("Couldn’t save the revision:", message);
  if (isCodesMissing(message)) return { error: `The database needs an update first. Run ${MIGRATION} in the Supabase SQL Editor, then save again.` };
  return { error: "Something went wrong, and nothing was saved. Please try again." };
}

/** A revision's editors: whoever started it and whoever sent it. They hear about every step, with the Central Comelec. */
const editorsOf = (revision: RevisionSummary) => [...new Set([revision.author.email, revision.submitted?.email].filter((email): email is string => Boolean(email)))];

/**
 * Saves the draft the editor holds: the whole text, and the note to those who sign. With
 * `intent=submit` it's then sent for approval, if nothing is in the way. The first save of a new
 * revision starts it, from the text that's published at that moment.
 */
export async function saveCodeRevision(code: CodeKey, _state: CodeFormState, formData: FormData): Promise<CodeFormState> {
  if (!isCodeKey(code)) return { error: "Unknown text." };
  const user = await requireCodeEditor(code);
  const person = personOf(user);
  const submit = text(formData, "intent") === "submit";
  const summary = text(formData, "summary").trim();
  if (summary.length > MAX_SUMMARY) return { error: "Keep the note to those who sign under 2,000 characters." };

  let sent: unknown = null;
  try {
    sent = JSON.parse(text(formData, "articles"));
  } catch {
    // Left null, which the check below refuses.
  }
  const parsed = articlesSchema.safeParse(sent);
  if (!parsed.success) return { error: "The text couldn’t be read, so nothing was saved. Something in it is longer than the portal takes: a heading, a paragraph, or the number of sections in an article." };
  const articles = tidyArticles(parsed.data);
  if (!hasUniqueAnchors(articles)) return { error: "The text couldn’t be read, so nothing was saved. Reload the page and try again." };

  let revision: RevisionSummary;
  try {
    const open = await getOpenRevision(code);
    const id = text(formData, "revision");
    if (!open && id) return { error: "This revision was published or discarded while you were editing, so it can’t be saved. Copy anything you need from here, then reload to start from the text as it stands now." };
    if (open && open.id !== id) return { error: `${open.author.name} started a revision of this text while you were editing, so yours wasn’t saved. Copy anything you need from here, then reload to carry on from theirs.` };
    if (open && open.status !== "draft") return { error: "This revision has been sent for approval, so its text is locked. Withdraw it to keep editing." };

    if (open) {
      // Saved only if it's as this editor last saw it: two people can't overwrite each other's work.
      const saved = Number(text(formData, "edits")) === open.edits ? await changeRevision(open, { articles, summary, stats: countChanges(open.baseArticles, articles) }, user.email) : null;
      if (!saved) return { error: "Someone else saved this draft after you opened it, so yours wasn’t saved over theirs. Copy anything you need from here, then reload to carry on from their version." };
      revision = saved;
    } else {
      const published = await getPublishedCode(code);
      const baseArticles = tidyArticles(published.articles);
      const stats = countChanges(baseArticles, articles);
      if (!totalChanges(stats)) return { error: "Nothing to save yet: the text is the same as what’s published." };
      revision = await createRevision({ code, articles, baseArticles, baseVersion: published.version, summary, stats, author: person });
      // A draft now exists, which the text's tab says. Later saves of it change nothing another page shows but a time.
      refresh(code);
    }
  } catch (error) {
    return saveError(error);
  }

  const saved = { id: revision.id, edits: revision.edits, at: revision.updatedAt };
  if (!submit) return { saved };

  const problems = problemsIn(articles);
  if (problems.length) return { error: "Saved as a draft. It can’t be sent for approval until these are fixed:", problems, saved };
  if (!totalChanges(revision.stats)) return { error: "Saved as a draft, but there’s nothing to approve: the text is the same as what’s published.", saved };
  if (summary.length < 10) return { error: "Saved as a draft. Before it’s sent for approval, write what changed and why for those who sign it.", saved };

  const at = new Date().toISOString();
  let pending: RevisionSummary | null;
  let emailed = false;
  try {
    pending = await changeRevision(revision, { status: "pending", submitted: { ...person, at }, approvals: {}, returned: null, events: [...revision.events, eventBy(person, "submitted", at)] }, user.email);
    if (!pending) return { error: "Someone else changed this draft just now, so it wasn’t sent. Reload to see where it stands." };
    const waiting = pending;
    const recipients = (await listApprovers()).map((approver) => approver.email);
    emailed = recipients.length > 0 && (await sendAutomatic("revision-approval", () => approvalRequestEmail(recipients, waiting, person))) === "sent";
    // The rest of the Central Comelec hears that it's waiting; the three who sign already have theirs.
    later(() => emailCentral("revision-submitted", (to) => revisionSubmittedEmail(to, waiting, person), { also: editorsOf(waiting), except: recipients }));
  } catch (error) {
    return { ...saveError(error), saved };
  }

  refresh(code);
  redirect(`${revisionPage(pending)}?notice=${emailed ? "code-submitted" : "code-submitted-no-email"}`);
}

/** The revision, if it's of the text the action was bound to. */
async function revisionOf(code: CodeKey, id: string) {
  const revision = await getRevisionSummary(id);
  return revision?.code === code ? revision : null;
}

/** Takes a revision back from approval, to keep editing it. Any approvals it had are cleared: what's sent again may differ. */
export async function withdrawCodeRevision(code: CodeKey, id: string) {
  if (!isCodeKey(code)) redirect("/portal");
  const user = await requireCodeEditor(code);
  const revision = await revisionOf(code, id);
  if (!revision) redirect(pageOf(code));

  const at = new Date().toISOString();
  const person = personOf(user);
  const withdrawn = revision.status === "pending" && (await changeRevision(revision, { status: "draft", approvals: {}, events: [...revision.events, eventBy(person, "withdrawn", at)] }, user.email));
  // Those told it was waiting are told it no longer is.
  if (withdrawn) later(() => emailCentral("revision-withdrawn", (to) => revisionWithdrawnEmail(to, withdrawn, person), { also: editorsOf(withdrawn) }));
  refresh(code);
  redirect(withdrawn ? `${pageOf(code)}/edit?notice=code-withdrawn` : `${revisionPage(revision)}?notice=code-moved-on`);
}

/** Gives a draft up. The published text stays as it is, and a new revision can be started. */
export async function discardCodeRevision(code: CodeKey, id: string) {
  if (!isCodeKey(code)) redirect("/portal");
  const user = await requireCodeEditor(code);
  const revision = await revisionOf(code, id);
  if (!revision) redirect(pageOf(code));

  const at = new Date().toISOString();
  const discarded = revision.status === "draft" && (await changeRevision(revision, { status: "discarded", decided_at: at, events: [...revision.events, eventBy(personOf(user), "discarded", at)] }, user.email));
  refresh(code);
  redirect(discarded ? `${pageOf(code)}?notice=code-discarded` : `${revisionPage(revision)}?notice=code-moved-on`);
}

/** How many times a signature is tried again when someone else signs at the same moment. */
const ATTEMPTS = 4;

/**
 * Signs a revision as the office the account holds. When it's the last of the three, the revision
 * is published: it becomes the next version of the text, and the website shows it.
 */
export async function approveCodeRevision(id: string, place: ReviewPlace) {
  const user = await requireApprover();
  const person = personOf(user);
  const back = (revision: Pick<RevisionSummary, "id" | "code">, notice: string) => redirect(`${revisionPage(revision, place)}?notice=${notice}`);

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const revision = await getRevisionSummary(id);
    if (!revision) redirect(tabHref("apps/approvals"));
    if (revision.status !== "pending") return back(revision, "code-moved-on");
    const role = approverRoleOf(user);
    if (!role || revision.approvals[role]) return back(revision, "code-already-signed");

    const signer = { ...person, role };
    const at = new Date().toISOString();
    const approvals = { ...revision.approvals, [role]: { name: person.name, email: person.email, at } };
    const complete = approverRoles.every((office) => approvals[office]);
    const signed = eventBy(signer, "approved", at);
    const changes = complete
      ? { approvals, status: "approved" as const, version: revision.baseVersion + 1, decided_at: at, events: [...revision.events, signed, eventBy(signer, "published", at)] }
      : { approvals, events: [...revision.events, signed] };
    const changed = await changeRevision(revision, changes, user.email);
    // Someone else signed, or sent it back, between the read and the write: read it again.
    if (!changed) continue;

    refresh(changed.code, complete);
    if (!complete) {
      // Every approval is announced, not only the last.
      later(() => emailCentral("revision-signed", (to) => revisionSignedEmail(to, changed, { name: signer.name, role }), { also: editorsOf(changed) }));
      return back(changed, "code-approved");
    }
    const emailed = (await emailCentral("revision-published", (to) => revisionPublishedEmail(to, changed), { also: editorsOf(changed) })) === "sent";
    return back(changed, emailed ? "code-published" : "code-published-no-email");
  }
  redirect(`${tabHref("apps/approvals")}?notice=code-busy`);
}

/**
 * Sends a revision back to its editors with what should change. It's a draft again, and any
 * approvals it had are cleared.
 */
export async function returnCodeRevision(id: string, place: ReviewPlace, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireApprover();
  const person = personOf(user);
  const role = approverRoleOf(user);
  if (!role) redirect(tabHref("apps/approvals"));
  const note = text(formData, "note").trim();
  if (note.length < 10) return { error: "Say what should change (at least 10 characters)." };
  if (note.length > MAX_SUMMARY) return { error: "Keep it under 2,000 characters." };

  let returned: RevisionSummary | null = null;
  for (let attempt = 0; attempt < ATTEMPTS && !returned; attempt++) {
    const revision = await getRevisionSummary(id);
    if (!revision) return { error: "This revision no longer exists." };
    if (revision.status !== "pending") return { error: "This revision is no longer waiting for approval. Reload to see where it stands." };
    const at = new Date().toISOString();
    returned = await changeRevision(revision, { status: "draft", approvals: {}, returned: { note, name: person.name, role, at }, events: [...revision.events, eventBy({ ...person, role }, "returned", at, note)] }, user.email);
  }
  if (!returned) return { error: "Someone else changed this revision just now. Reload to see where it stands." };

  const sentBack = returned;
  const emailed = (await emailCentral("revision-returned", (to) => revisionReturnedEmail(to, sentBack, { name: person.name, email: person.email, role }, note), { also: editorsOf(sentBack) })) === "sent";
  refresh(returned.code);
  redirect(`${revisionPage(returned, place)}?notice=${emailed ? "code-returned" : "code-returned-no-email"}`);
}

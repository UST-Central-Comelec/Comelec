"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSignUp } from "@/lib/filing-portal/schema";
import { isContactPerson, requireFilingAccount, requirePartyMember, startFilingSession } from "@/lib/filing-portal/session";
import { accountForSignUp } from "@/lib/filing-portal/sign-up";
import { fullName } from "@/lib/filing-portal/types";
import { clearFilingPass, readFilingPass } from "@/lib/filing-portal/verification";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { openUnits } from "@/lib/periods/summary";
import { unitKey } from "@/lib/periods/kinds";
import { ensureReferenceData } from "@/lib/reference/store";
import { noticeJoinDecision, noticeJoinRequest } from "./notify";
import { newPartyFields, partyErrors } from "./schema";
import { addNotice, createPartyWithContact, decideRequest, membershipOfAccount, requestToJoin, withdrawJoinRequest } from "./store";

// Political Party Registration's actions: joining or making a party from the registration page,
// and the contact person answering requests to join. Each checks who's asking first. A party's
// documents go through the filing portal's own (src/lib/filing-portal/document-actions.ts).

export type SignUpState = { error?: string; fieldErrors?: Record<string, string>; expired?: boolean } | undefined;
export type ActionResult = { ok?: string; error?: string };

const failures = {
  "name-taken": { field: "partyName", message: "A party with that name is already registering. Pick it from the list to ask to join it, or use another name." },
  "email-taken": { field: null, message: "This UST account is already in a party. Sign in to the filing portal instead." },
  closed: { field: "unit", message: "That unit stopped taking registrations. Choose another, or watch the commission’s announcements." },
  "party-gone": { field: "partyId", message: "That party is no longer taking members. Pick another, or make a new one." },
} as const;

/** Joins the party picked, or makes a new one with this person as its contact. Makes the account first if it's new. */
export async function registerParty(_state: SignUpState, formData: FormData): Promise<SignUpState> {
  await ensureReferenceData();
  const pass = await readFilingPass();
  if (!pass) return { error: "Your UST verification ran out. Go back to the first step and continue with UST Google again.", expired: true };
  const values = readSignUp(formData);
  if (!values.consent) return { error: "Agree to the Data Privacy Statement on the first step to continue.", fieldErrors: { consent: "Tick this box to continue." } };

  const openKeys = openUnits(await listUnitPeriodsForSite("party-registration")).map((period) => unitKey(period.unit));
  const partyProblems = partyErrors(values, openKeys);
  let resolved;
  try {
    resolved = await accountForSignUp(pass, values);
  } catch (error) {
    console.error("Couldn’t make the filing portal account:", error instanceof Error ? error.message : error);
    return { error: "Your account couldn’t be made. Try again in a moment. Your answers are still here." };
  }
  if ("suspended" in resolved) return { error: "This UST account can’t file through the filing portal right now. Write to comelec@ust.edu.ph." };
  const fieldErrors = { ...("fieldErrors" in resolved ? resolved.fieldErrors : {}), ...partyProblems };
  if (Object.keys(fieldErrors).length || !("account" in resolved)) return { error: "Check the highlighted answers.", fieldErrors };
  const { account } = resolved;

  if (await membershipOfAccount(account.id)) {
    await clearFilingPass();
    await startFilingSession(account);
    redirect("/filing/party");
  }

  let result;
  try {
    if (values.partyId) result = await requestToJoin(values.partyId, account);
    else {
      const party = newPartyFields.parse(values);
      result = await createPartyWithContact({ name: party.partyName, college: party.unit === "central" ? "" : party.unit, establishedAt: party.establishedAt, headquarters: party.headquarters }, account);
    }
  } catch (error) {
    console.error("Couldn’t register the party:", error instanceof Error ? error.message : error);
    return { error: "Your registration couldn’t be saved. Try again in a moment. Your answers are still here." };
  }
  if ("error" in result) {
    const failure = failures[result.error];
    return { error: failure.message, fieldErrors: failure.field ? { [failure.field]: failure.message } : undefined };
  }

  await clearFilingPass();
  await startFilingSession(account);
  if (values.partyId) await noticeJoinRequest(result.party, result.member);
  redirect(values.partyId ? "/filing?notice=requested" : "/filing/party?notice=created");
}

/** The contact person approves or declines someone asking to join. */
export async function answerJoinRequest(memberId: string, approve: boolean): Promise<ActionResult> {
  const account = await requirePartyMember();
  if (!isContactPerson(account)) return { error: "Only the party’s contact person can answer requests to join." };
  if (approve && account.party.sanction) return { error: `The party is ${account.party.sanction}, so it can’t take members now.` };
  const decided = await decideRequest(account.party.id, memberId, approve, account.member.email);
  if (!decided) return { error: "That request was already answered. The list now shows where it stands." };
  await noticeJoinDecision(account.party, decided, approve, fullName(account.member));
  revalidatePath("/filing", "layout");
  return { ok: approve ? `${fullName(decided)} is now a member, and they’ve been emailed.` : `${fullName(decided)}’s request was declined, and they’ve been emailed.` };
}

export type JoinState = { error?: string; fieldErrors?: Record<string, string> } | undefined;

/**
 * From the filing portal's Political Party tab, for a signed-in account without a party: ask to
 * join one that's registering, or register a new one with them as its contact person. The same
 * checks as the registration page, without signing up again.
 */
export async function joinPartyFromPortal(_state: JoinState, formData: FormData): Promise<JoinState> {
  await ensureReferenceData();
  const { account, membership } = await requireFilingAccount();
  if (membership) redirect("/filing/party");
  const values = readSignUp(formData);
  const openKeys = openUnits(await listUnitPeriodsForSite("party-registration")).map((period) => unitKey(period.unit));
  const fieldErrors = values.partyId ? {} : partyErrors(values, openKeys);
  if (formData.get("mode") === "join" && !values.partyId) fieldErrors.partyId = "Pick the party you’re joining from the list.";
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted answers.", fieldErrors };

  let result;
  try {
    if (values.partyId) result = await requestToJoin(values.partyId, account);
    else {
      const party = newPartyFields.parse(values);
      result = await createPartyWithContact({ name: party.partyName, college: party.unit === "central" ? "" : party.unit, establishedAt: party.establishedAt, headquarters: party.headquarters }, account);
    }
  } catch (error) {
    console.error("Couldn’t join or register the party:", error instanceof Error ? error.message : error);
    return { error: "That couldn’t be saved. Try again in a moment. Your answers are still here." };
  }
  if ("error" in result) {
    const failure = failures[result.error];
    return { error: failure.message, fieldErrors: failure.field ? { [failure.field]: failure.message } : undefined };
  }
  if (values.partyId) await noticeJoinRequest(result.party, result.member);
  revalidatePath("/filing", "layout");
  redirect(values.partyId ? "/filing/party?notice=requested" : "/filing/party?notice=created");
}

/** Takes back the account's own request to join, so they can join or register another party. */
export async function cancelJoinRequest(): Promise<ActionResult> {
  const { account, membership } = await requireFilingAccount();
  if (!membership || membership.member.status !== "requested") return { error: "There’s no request waiting to take back. The page now shows where you stand." };
  const taken = await withdrawJoinRequest(membership.member.id, account.id, account.email);
  if (!taken) return { error: "Your request was already answered. The page now shows where you stand." };
  await addNotice({ partyId: membership.party.id, kind: "member-request-withdrawn", title: `${fullName(taken)} took back their request to join`, actor: fullName(taken), href: "/filing/party/members", forContact: true });
  revalidatePath("/filing", "layout");
  return { ok: `Your request to join ${membership.party.name} is taken back. You can join or register another party.` };
}

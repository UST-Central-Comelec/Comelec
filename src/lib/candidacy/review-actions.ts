"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { getAccount } from "@/lib/filing-portal/accounts";
import { documentProgress, isReadyToDecide, stillToApprove } from "@/lib/filing-portal/types";
import { getParty } from "@/lib/party-portal/store";
import { canFieldCandidates } from "@/lib/party-portal/types";
import { canReadParty } from "@/lib/polpar/store";
import { text } from "@/lib/portal/form";
import { candidacyRequirements } from "./content";
import { noticeCandidacyDecision, noticeCandidacyFeedback, noticeCandidacyWithdrawn } from "./notify";
import { decideCandidacy, getCandidacy, getCandidacyDocumentById, listCandidacyDocuments, reviewCandidacyDocument, withdrawCandidacyByUnit } from "./store";
import { candidacyStatusLabel, reachesUnit } from "./types";

// The Comelec unit's side (Filing of Candidacy → Applicants): reviewing a candidate's documents one
// by one, deciding whether they're qualified, and recording a withdrawal. A Local unit acts only on
// its own college's filings. Reviews and decisions wait until the filing reaches the unit
// (independent, or endorsed by its party).

export type ReviewState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;
export type ActionResult = { ok?: string; error?: string };

async function candidacyFor(id: string) {
  const user = await requireEditor("candidacy/filings");
  const candidacy = await getCandidacy(id);
  if (!candidacy || !canReadParty(user, candidacy.college)) notFound();
  const candidate = await getAccount(candidacy.accountId);
  if (!candidate) notFound();
  return { user, candidacy, candidate };
}

function refresh(candidacyId: string) {
  revalidatePath("/portal/candidacy/filings", "layout");
  revalidatePath(`/portal/candidacy/filings/${candidacyId}`);
}

const notYet = "This filing hasn’t reached the unit yet: the candidate’s party hasn’t endorsed them.";

/** As for a party's documents: only while pending, and only over the files the reviewer saw (`seen`). */
export async function reviewCandidacyDocumentAction(candidacyId: string, documentId: string, seen: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, candidacy, candidate } = await candidacyFor(candidacyId);
  if (!reachesUnit(candidacy)) return { error: notYet };
  const document = await getCandidacyDocumentById(documentId);
  if (!document || document.candidacyId !== candidacy.id) notFound();
  if (candidacy.status !== "pending") return { error: "This candidacy has been decided. Reopen it for review first, then change the document’s review." };
  const decision = text(form, "decision");
  const feedback = text(form, "feedback");
  if (decision !== "approved" && decision !== "changes") return { error: "Choose Approve or Return for revisions.", fieldErrors: { decision: "Choose one." } };
  if (decision === "changes" && !feedback) return { error: "Say what to revise, so the candidate knows what to fix.", fieldErrors: { feedback: "Say what to revise." } };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters.", fieldErrors: { feedback: "Use 3,000 characters or fewer." } };
  if (!document.files.length) return { error: "This document has no files to review yet." };
  if (document.status === "draft") return { error: "The candidate took this document back to change it. You can review it once they send it again." };
  if (decision === document.status && feedback === document.feedback) return { saved: "Nothing changed." };
  const saved = await reviewCandidacyDocument(document.id, decision, feedback, user.email, seen);
  if (!saved) {
    refresh(candidacy.id);
    const now = await getCandidacyDocumentById(document.id);
    return { error: now?.status === "draft" ? "The candidate took this document back to change it. The page now shows where it stands." : "This document changed since you opened it. Look over its files again, then review it." };
  }
  await noticeCandidacyFeedback(candidacy, candidate, document.requirement, decision === "approved", feedback);
  refresh(candidacy.id);
  return { saved: decision === "approved" ? "Approved. The candidate has been notified." : "Returned for revisions. The candidate has been notified." };
}

/**
 * Qualifies or disqualifies the candidate, or reopens the filing. Disqualifying needs a reason.
 * Qualifying needs every required document approved and none waiting, unless the commissioner
 * overrides it with remarks saying why; and, for a party's candidate, the party still accredited
 * and not suspended or blacklisted, which can't be overridden.
 */
export async function decideCandidacyAction(candidacyId: string, _state: ReviewState, form: FormData): Promise<ReviewState> {
  const { user, candidacy, candidate } = await candidacyFor(candidacyId);
  if (!reachesUnit(candidacy)) return { error: notYet };
  if (candidacy.status === "withdrawn") return { error: "This candidacy was withdrawn, so it can’t be decided." };
  const decision = text(form, "decision");
  const remarks = text(form, "remarks");
  if (decision !== "pending" && decision !== "qualified" && decision !== "disqualified") return { error: "Choose a decision.", fieldErrors: { decision: "Choose one." } };
  if (decision === "disqualified" && !remarks) return { error: "Say why the candidate isn’t qualified.", fieldErrors: { remarks: "Say why." } };
  if (remarks.length > 3000) return { error: "Keep the remarks under 3,000 characters.", fieldErrors: { remarks: "Use 3,000 characters or fewer." } };
  if (decision === candidacy.status && remarks === candidacy.decisionRemarks) return { saved: "Nothing changed." };
  let override = false;
  if (decision === "qualified") {
    const party = candidacy.partyId ? await getParty(candidacy.partyId) : null;
    if (candidacy.partyId && (!party || !canFieldCandidates(party))) return { error: `${candidacy.partyName ?? "The candidate’s party"} ${party?.sanction ? `is ${party.sanction}` : "isn’t accredited now"}, so they can’t be qualified as its candidate. They can withdraw and file again as an independent.` };
    const progress = documentProgress(candidacyRequirements, await listCandidacyDocuments(candidacy.id));
    if (!isReadyToDecide(progress)) {
      if (form.get("override") !== "on") return { error: progress.waiting ? `Review the ${progress.waiting === 1 ? "document" : `${progress.waiting} documents`} waiting first, or tick “Qualify with documents outstanding”.` : `Approve every required document before qualifying the candidate, or tick “Qualify with documents outstanding”. ${stillToApprove(progress)}` };
      if (!remarks) return { error: "Say why they’re qualified with documents outstanding.", fieldErrors: { remarks: "Say why they’re qualified anyway." } };
      override = true;
    }
  }
  const saved = await decideCandidacy(candidacy.id, decision, remarks, user.email, override);
  if (!saved) return { error: "Couldn’t save the decision. Try again." };
  await noticeCandidacyDecision(saved, candidate, decision, remarks);
  refresh(candidacy.id);
  return { saved: decision === "pending" ? "Reopened for review. The candidate has been notified, and they can change their documents again." : `The candidate is ${candidacyStatusLabel[decision].toLowerCase()}${override ? " with documents outstanding" : ""}. They’ve been notified.` };
}

/** Records the candidate's withdrawal, on their sworn declaration (Elections Code, Section 6.1). They can file again while filing is open. */
export async function withdrawCandidacyForCandidate(candidacyId: string, reason: string): Promise<ActionResult> {
  const { user, candidacy, candidate } = await candidacyFor(candidacyId);
  const note = reason.trim().slice(0, 3000);
  if (!note) return { error: "Say what the withdrawal rests on, like the date of the sworn declaration. The candidate will read it." };
  const withdrawn = await withdrawCandidacyByUnit(candidacy.id, user.email, note);
  if (!withdrawn) return { error: "This candidacy was already withdrawn." };
  await noticeCandidacyWithdrawn(withdrawn, candidate, note);
  refresh(candidacy.id);
  return { ok: "The candidacy is withdrawn. The candidate has been notified." };
}

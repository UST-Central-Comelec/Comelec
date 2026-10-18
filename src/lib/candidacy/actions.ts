"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addAccountNotice, getAccount } from "@/lib/filing-portal/accounts";
import { readSignUp } from "@/lib/filing-portal/schema";
import { isContactPerson, requireCandidacy, requirePartyMember, startFilingSession } from "@/lib/filing-portal/session";
import { accountForSignUp } from "@/lib/filing-portal/sign-up";
import { fullName } from "@/lib/filing-portal/types";
import { clearFilingPass, readFilingPass } from "@/lib/filing-portal/verification";
import { getParty, listJoinableParties } from "@/lib/party-portal/store";
import { canFieldCandidates } from "@/lib/party-portal/types";
import { listUnitPeriodsForSite } from "@/lib/periods/store";
import { openUnits } from "@/lib/periods/summary";
import { unitKey } from "@/lib/periods/kinds";
import { ensureReferenceData } from "@/lib/reference/store";
import { noticeEndorsementDecision, noticeEndorsementRequest } from "./notify";
import { loadElectivePositions } from "./positions-store";
import { candidacyErrors, candidacyFields } from "./schema";
import { candidacyOfAccount, createCandidacy, decideEndorsement, getCandidacy, withdrawCandidacy } from "./store";

// Filing of Candidacy's actions: filing from the Filing of Candidacy page, and a party's contact
// person endorsing a member who runs under it. Each checks who's asking first. The candidacy's
// documents go through the filing portal's own (src/lib/filing-portal/document-actions.ts).

export type SignUpState = { error?: string; fieldErrors?: Record<string, string>; expired?: boolean } | undefined;
export type ActionResult = { ok?: string; error?: string };

/** Files the candidacy, making the account first if it's new. One under a party waits for its endorsement. */
export async function fileCandidacy(_state: SignUpState, formData: FormData): Promise<SignUpState> {
  await ensureReferenceData();
  const pass = await readFilingPass();
  if (!pass) return { error: "Your UST verification ran out. Go back to the first step and continue with UST Google again.", expired: true };
  const values = readSignUp(formData);
  if (!values.consent) return { error: "Agree to the Data Privacy Statement on the first step to continue.", fieldErrors: { consent: "Tick this box to continue." } };

  const [periods, { positions }, parties] = await Promise.all([listUnitPeriodsForSite("candidacy"), loadElectivePositions(), listJoinableParties("accredited")]);
  const openKeys = openUnits(periods).map((period) => unitKey(period.unit));
  const names = Object.fromEntries(Object.entries(positions).map(([unit, list]) => [unit, list.map((position) => position.name)]));
  const candidacyProblems = candidacyErrors(values, openKeys, names, parties);
  let resolved;
  try {
    resolved = await accountForSignUp(pass, values);
  } catch (error) {
    console.error("Couldn’t make the filing portal account:", error instanceof Error ? error.message : error);
    return { error: "Your account couldn’t be made. Try again in a moment. Your answers are still here." };
  }
  if ("suspended" in resolved) return { error: "This UST account can’t file through the filing portal right now. Write to comelec@ust.edu.ph." };
  const fieldErrors = { ...("fieldErrors" in resolved ? resolved.fieldErrors : {}), ...candidacyProblems };
  if (Object.keys(fieldErrors).length || !("account" in resolved)) return { error: "Check the highlighted answers.", fieldErrors };
  const { account } = resolved;

  if (await candidacyOfAccount(account.id)) {
    await clearFilingPass();
    await startFilingSession(account);
    redirect("/filing/candidacy");
  }

  const filed = candidacyFields.parse(values);
  const party = filed.runningFor === "party" ? parties.find((item) => item.id === values.candidacyParty) ?? null : null;
  let candidacy;
  try {
    candidacy = await createCandidacy({ accountId: account.id, college: filed.unit === "central" ? "" : filed.unit, position: filed.position, partyId: party?.id ?? null, dateOfBirth: filed.dateOfBirth, residence: filed.residence });
  } catch (error) {
    console.error("Couldn’t file the candidacy:", error instanceof Error ? error.message : error);
    return { error: "Your candidacy couldn’t be filed. Try again in a moment. Your answers are still here." };
  }
  if (candidacy === "closed") return { error: "That unit stopped taking filings. Choose another, or watch the commission’s announcements.", fieldErrors: { unit: "This unit stopped taking filings." } };
  if (candidacy === "taken") return { error: "This UST account has already filed a candidacy. Sign in to the filing portal instead." };

  await clearFilingPass();
  await startFilingSession(account);
  const fullParty = party ? await getParty(party.id) : null;
  if (fullParty) await noticeEndorsementRequest(fullParty, candidacy, account);
  redirect("/filing/candidacy?notice=filed");
}

/** A party's contact person endorses a member running under the party, or declines to. */
export async function answerEndorsement(candidacyId: string, endorse: boolean): Promise<ActionResult> {
  const account = await requirePartyMember();
  if (!isContactPerson(account)) return { error: "Only the party’s contact person can endorse candidates." };
  if (endorse && !canFieldCandidates(account.party)) return { error: account.party.sanction ? `The party is ${account.party.sanction}, so it can’t endorse candidates now.` : "The party isn’t accredited now, so it can’t endorse candidates." };
  const candidacy = await getCandidacy(candidacyId);
  if (!candidacy || candidacy.partyId !== account.party.id) return { error: "That candidate isn’t running under your party." };
  const decided = await decideEndorsement(candidacy.id, account.party.id, endorse, account.member.email);
  if (!decided) return { error: "That candidate was already answered. The list now shows where they stand." };
  const candidate = await getAccount(decided.accountId);
  if (candidate) await noticeEndorsementDecision(account.party, decided, candidate, endorse, fullName(account.member));
  revalidatePath("/filing", "layout");
  const name = candidate ? fullName(candidate) : "The candidate";
  return { ok: endorse ? `${name} is endorsed, and their filing goes to the unit. They’ve been emailed.` : `${name} wasn’t endorsed, and they’ve been emailed.` };
}

/** Withdraws the candidate's own filing while it's pending (Elections Code, Section 6.1), so they can file again. */
export async function withdrawMyCandidacy(): Promise<ActionResult> {
  const { account, candidacy } = await requireCandidacy();
  const withdrawn = await withdrawCandidacy(candidacy.id, account.id, account.email);
  if (!withdrawn) return { error: "This candidacy has already been decided, so it can’t be withdrawn here. Write to your Comelec unit." };
  await addAccountNotice({ accountId: account.id, kind: "candidacy-withdrawn", title: `You withdrew your candidacy for ${candidacy.position}`, body: "Give your Comelec unit your sworn declaration of withdrawal too.", actor: "You" });
  revalidatePath("/filing", "layout");
  redirect("/filing?notice=withdrawn");
}

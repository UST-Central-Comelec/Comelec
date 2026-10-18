"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { programLocked } from "@/lib/applications/options";
import { requireEditor } from "@/lib/auth/session";
import { unitName } from "@/lib/party-portal/types";
import { ensureReferenceData } from "@/lib/reference/store";
import { endAccountSessions, getAccountDetail, setAccountSuspended, touchesUnit, updateAccountProfile } from "./commission";
import { noticeAccountChange } from "./notify";
import { profileErrors, profileFields, readSignUp } from "./schema";
import { fullName } from "./types";

// The commission managing the filing portal's accounts, from either Applicants tab (PolPaR or
// Filing of Candidacy → Accounts): correcting an account's details, suspending or restoring it,
// and ending its sessions. A Local unit only manages accounts tied to its own college's parties
// and filings. The account holder is notified and emailed (./notify.ts), except when only their
// sessions end.

export type AccountFormState = { error?: string; fieldErrors?: Record<string, string>; saved?: string } | undefined;
export type ActionResult = { ok?: string; error?: string };
export type AccountsArea = "polpar" | "candidacy";

async function accountFor(area: AccountsArea, id: string) {
  const user = await requireEditor(area === "polpar" ? "polpar/registrations" : "candidacy/filings");
  const detail = await getAccountDetail(id);
  const local = user.affiliation === "local";
  if (!detail || (local && !user.college) || !touchesUnit(detail.units, local ? user.college : null)) notFound();
  return { user, detail, unit: local ? unitName(user.college ?? "") : unitName("") };
}

function refresh(id: string) {
  for (const base of ["/portal/polpar/registrations", "/portal/candidacy/filings"]) {
    revalidatePath(`${base}/accounts`);
    revalidatePath(`${base}/accounts/${id}`);
  }
}

/**
 * Corrects the account's profile, over the version the commissioner opened (`seen`). Names,
 * student numbers and mobile numbers follow every form's rules (src/lib/forms/fields.ts). The
 * party rosters it's on take the correction too.
 */
export async function updateFilingAccount(area: AccountsArea, id: string, seen: string, _state: AccountFormState, form: FormData): Promise<AccountFormState> {
  await ensureReferenceData();
  const { detail, unit } = await accountFor(area, id);
  const values = readSignUp(form);
  const fieldErrors = profileErrors(values);
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted answers.", fieldErrors };
  const profile = profileFields.parse(values);
  const change = {
    lastName: profile.lastName, firstName: profile.firstName, middleName: profile.middleName, studentNumber: profile.studentNumber, mobileNumber: profile.contactNumber,
    facebookUrl: profile.facebookUrl, college: profile.college, program: programLocked(profile.college) ? "" : profile.program, yearLevel: profile.yearLevel,
  };
  const before = detail.account;
  if ((Object.keys(change) as Array<keyof typeof change>).every((key) => change[key] === before[key])) return { saved: "Nothing changed." };
  const saved = await updateAccountProfile(before.id, change, seen);
  if (saved === "missing") return { error: "This account no longer exists." };
  if (saved === "conflict") {
    refresh(before.id);
    return { error: "Someone changed this account since you opened it. Close this, look over the latest details, then correct them again." };
  }
  await noticeAccountChange(saved, { kind: "updated" }, unit);
  refresh(before.id);
  return { saved: `${fullName(saved)}’s details are corrected, and they’ve been emailed.` };
}

/** Suspends the account: it can't sign in or file, and its open sessions end. Needs a reason, which they're emailed. */
export async function suspendFilingAccount(area: AccountsArea, id: string, reason: string): Promise<ActionResult> {
  const { user, detail, unit } = await accountFor(area, id);
  const note = reason.trim().slice(0, 2000);
  if (!note) return { error: "Say why the account is suspended. They’ll be emailed it." };
  const saved = await setAccountSuspended(detail.account.id, true, user.email, note);
  if (!saved) return { error: "This account was already suspended." };
  await noticeAccountChange(saved, { kind: "suspended", reason: note }, unit);
  refresh(saved.id);
  return { ok: `${fullName(saved)} is suspended and signed out, and they’ve been emailed.` };
}

export async function restoreFilingAccount(area: AccountsArea, id: string): Promise<ActionResult> {
  const { user, detail, unit } = await accountFor(area, id);
  const saved = await setAccountSuspended(detail.account.id, false, user.email, "");
  if (!saved) return { error: "This account isn’t suspended." };
  await noticeAccountChange(saved, { kind: "restored" }, unit);
  refresh(saved.id);
  return { ok: `${fullName(saved)} can sign in again, and they’ve been emailed.` };
}

/** Ends every session the account has open, say after a shared computer was left signed in. They can sign in again. */
export async function endFilingAccountSessions(area: AccountsArea, id: string): Promise<ActionResult> {
  const { detail } = await accountFor(area, id);
  const saved = await endAccountSessions(detail.account.id);
  if (!saved) return { error: "This account no longer exists." };
  refresh(saved.id);
  return { ok: `${fullName(saved)} is signed out everywhere. They can sign in again.` };
}

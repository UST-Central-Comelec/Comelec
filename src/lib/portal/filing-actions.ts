"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCentral } from "@/lib/auth/session";
import { filingKinds, isFilingKind, type FilingKind } from "@/lib/filings/kinds";
import { getFilingPeriod, saveFilingPeriod } from "@/lib/filings/period-store";
import type { FormState } from "./form";
import { canCancelClosing, graceEnd, modeAfterCancel, readPeriodForm } from "./period-form";

// Opening and closing Political Party Registration and Filing of Candidacy, from each one's Settings
// subtab. The portal binds `kind` to these; it's checked again since bound values come back from
// the browser.

export async function updateFilingPeriod(kind: FilingKind, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireCentral();
  if (!isFilingKind(kind)) return { error: "Unknown filing." };

  const form = readPeriodForm(formData);
  if ("error" in form) return form.error;
  const { mode, closesAt } = form;

  try {
    await saveFilingPeriod(kind, { mode, closesAt, graceEndsAt: mode === "closed" ? graceEnd(await getFilingPeriod(kind)) : null }, email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the filing period." };
  }

  refreshFilingPages(kind);
  redirect(`${filingKinds[kind].portalHref}/settings?notice=filing-${mode}`);
}

/** Stops a close that's still in its grace period: back to the schedule if its date is still ahead, otherwise open. */
export async function cancelFilingClosing(kind: FilingKind) {
  const { email } = await requireCentral();
  if (!isFilingKind(kind)) redirect("/portal");
  const settings = `${filingKinds[kind].portalHref}/settings`;

  const current = await getFilingPeriod(kind);
  if (!canCancelClosing(current)) redirect(`${settings}?notice=filing-cancel-too-late`);
  await saveFilingPeriod(kind, { mode: modeAfterCancel(current), closesAt: current.closesAt, graceEndsAt: null }, email);
  refreshFilingPages(kind);
  redirect(`${settings}?notice=filing-close-cancelled`);
}

function refreshFilingPages(kind: FilingKind) {
  revalidatePath(filingKinds[kind].href);
  revalidatePath(`${filingKinds[kind].portalHref}/settings`);
}

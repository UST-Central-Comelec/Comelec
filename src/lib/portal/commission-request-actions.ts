"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { comelecUnits } from "@/lib/applications/options";
import { ensureReferenceData } from "@/lib/reference/store";
import { manilaInstant, MAX_ACTIVITY_HOURS } from "@/lib/filing-portal/services";
import { text, toFormState, type FormState } from "./form";
import { canAnswerCommissionRequest, commissionRequestSchema, requestTypeSchema } from "./commission-requests";
import { answerCommissionRequest, getCommissionRequest, listCommissionRequestTypes, writeCommissionRequests, writeCommissionRequestType } from "./commission-requests-store";
import { notifyCommissionRequest } from "./commission-request-notify";

export type CommissionRequestState = NonNullable<FormState> & { sent?: boolean; message?: string };
const refresh = () => revalidatePath("/portal/request", "layout");

export async function createCommissionRequest(_state: CommissionRequestState, form: FormData): Promise<CommissionRequestState> {
  const user = await requireEditor("request/create");
  await ensureReferenceData();
  const parsed = commissionRequestSchema.safeParse(Object.fromEntries(["type", "recipient", "subject", "details", "mode", "venue", "date", "start", "end", "submission"].map(key => [key, text(form, key)])));
  if (!parsed.success) return toFormState(parsed.error)!;
  const value = parsed.data;
  const recipients = value.recipient === "all" ? [...comelecUnits] : comelecUnits.includes(value.recipient) ? [value.recipient] : [];
  if (!recipients.length) return { error: "Choose an available Local unit.", fieldErrors: { recipient: "Choose a Local unit." } };
  const starts = manilaInstant(value.date, value.start), ends = manilaInstant(value.date, value.end);
  if (!Number.isFinite(starts) || starts <= Date.now()) return { error: "Choose a future date and time.", fieldErrors: { date: "Choose a future date and time." } };
  if (ends <= starts || ends - starts > MAX_ACTIVITY_HOURS * 3600000) return { error: "Choose an end time after the start, within twelve hours.", fieldErrors: { end: "Choose an end time after the start, within twelve hours." } };
  try {
    const type = (await listCommissionRequestTypes()).find(type => type.id === value.type && type.enabled);
    if (!type) return { error: "That request type is no longer available. Reload and choose another type." };
    const result = await writeCommissionRequests(recipients.map(college => ({ batch_id: value.submission, sender_email: user.email, sender_name: user.name, sender_college: user.affiliation === "local" ? user.college : null, college, type_id: type.id, type_name: type.name, subject: value.subject, details: value.details, mode: value.mode, venue: value.venue, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString() })));
    if (result.requests) for (const request of result.requests) notifyCommissionRequest(request);
    refresh();
    return { sent: true, message: result.duplicate ? "This request was already sent. Check your sent requests." : `Request sent to ${recipients.length === 1 ? "the Local unit" : `all ${recipients.length} Local units`}. Each unit can answer it in Approvals.` };
  } catch (error) { unstable_rethrow(error); return { error: "Couldn’t send the request. Try again." }; }
}

export async function saveCommissionRequestType(id: string | null, seen: string, _state: CommissionRequestState, form: FormData): Promise<CommissionRequestState> {
  const user = await requireEditor("request/settings");
  if (user.affiliation !== "central") return { error: "Only the Central Comelec can manage request types." };
  const parsed = requestTypeSchema.safeParse({ name: text(form, "name"), description: text(form, "description"), enabled: form.get("enabled") === "on" });
  if (!parsed.success) return toFormState(parsed.error)!;
  try {
    if (!(await writeCommissionRequestType(id, seen, parsed.data, user.email))) return { error: "Someone changed this type while you were editing. Reload to see their changes, then try again." };
    refresh(); return { sent: true, message: "Request type saved. New requests use the updated options." };
  } catch (error) { unstable_rethrow(error); return { error: error instanceof Error ? error.message : "Couldn’t save the request type. Try again." }; }
}

export async function answerCommissionRequestAction(id: string, seen: string, _state: CommissionRequestState, form: FormData): Promise<CommissionRequestState> {
  const user = await requireEditor("request");
  const status = text(form, "decision"), response = text(form, "response").trim();
  if (status !== "confirmed" && status !== "declined" && status !== "done") return { error: "Choose Approve or Decline." };
  if (response.length > 3000 || (status === "declined" && !response)) return { error: "Give a reason when declining, using at most 3,000 characters.", fieldErrors: { response: "Give a reason when declining, using at most 3,000 characters." } };
  try {
    const request = await getCommissionRequest(id);
    if (!request || !canAnswerCommissionRequest(user, request)) return { error: "Only the receiving Local unit or the Central Comelec can answer this request." };
    const saved = await answerCommissionRequest(id, seen, status, response, user.email);
    if (!saved) return { error: "This request changed while you were reviewing it. Reload to see its current status." };
    notifyCommissionRequest(saved, true); refresh();
    return { sent: true, message: "Request updated. The sender will be notified by email." };
  } catch (error) { unstable_rethrow(error); return { error: "Couldn’t save the answer. Try again." }; }
}

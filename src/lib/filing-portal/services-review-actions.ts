"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { canReadParty } from "@/lib/polpar/store";
import { text } from "@/lib/portal/form";
import { getAccount } from "./accounts";
import { MAX_ACTIVITY_HOURS, manilaInstant, petitionStatusLabel, type PetitionStatus } from "./services";
import { noticePetitionMoved, noticeRequestAnswered } from "./services-notify";
import { answerRequest, getPetition, getRequest, movePetition, type RequestAnswer } from "./services-store";

// The Comelec unit's side of the filing portal's Services: answering a consultation or a
// commissioner request (Request), and moving a petition through the Case Docket (Petitions and
// Cases → Case Docket). A Local unit acts only on what's addressed to its own college. Each change
// goes only over the version the commissioner opened, and the filer is notified and emailed.

export type AnswerState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; sentAt?: number } | undefined;
export type ActionResult = { ok?: string; error?: string };

const field = (form: FormData, name: string) => text(form, name).trim();
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const moved = "This changed since you opened it. The page now shows where it stands.";

async function requestFor(id: string) {
  const user = await requireEditor("request");
  const request = await getRequest(id);
  if (!request || !canReadParty(user, request.college)) notFound();
  const filer = await getAccount(request.accountId);
  if (!filer) notFound();
  return { user, request, filer };
}

function refreshRequests(id: string) {
  revalidatePath("/portal/request", "layout");
  revalidatePath(`/portal/request/${id}`);
}

/** Confirms a request with a time, a place and who goes, or changes what was confirmed. */
export async function confirmRequestAction(id: string, seen: string, _state: AnswerState, form: FormData): Promise<AnswerState> {
  const { user, request, filer } = await requestFor(id);
  if (request.status !== "requested" && request.status !== "confirmed") return { error: `It’s ${request.status}, so it can’t be confirmed.` };
  const errors: Record<string, string> = {};
  const date = field(form, "date");
  const start = field(form, "start");
  const end = field(form, "end");
  const location = field(form, "location");
  const assigned = field(form, "assigned");
  const response = field(form, "response");
  if (!isDay(date)) errors.date = "Pick a day.";
  if (!isTime(start)) errors.start = "Pick when it starts.";
  if (!isTime(end)) errors.end = "Pick when it ends.";
  if (!location) errors.location = request.mode === "online" ? "Give the meeting link." : "Give the room or the place.";
  else if (location.length > 300) errors.location = "Keep it under 300 characters.";
  if (!assigned) errors.assigned = request.kind === "consultation" ? "Say who meets them." : "Say which commissioner goes.";
  else if (assigned.length > 300) errors.assigned = "Keep it under 300 characters.";
  if (response.length > 3000) errors.response = "Keep the note under 3,000 characters.";
  const startsAt = isDay(date) && isTime(start) ? manilaInstant(date, start) : NaN;
  const endsAt = isDay(date) && isTime(end) ? manilaInstant(date, end) : NaN;
  if (!errors.date && !errors.start && !errors.end) {
    if (endsAt <= startsAt) errors.end = "It has to end after it starts.";
    else if (endsAt - startsAt > MAX_ACTIVITY_HOURS * 3_600_000) errors.end = `Keep it to ${MAX_ACTIVITY_HOURS} hours or less.`;
    else if (startsAt < Date.now()) errors.date = "Pick a time that hasn’t passed.";
  }
  if (Object.keys(errors).length) return { error: "Check the highlighted answers.", fieldErrors: errors };
  const answer: RequestAnswer = { status: "confirmed", start: new Date(startsAt).toISOString(), end: new Date(endsAt).toISOString(), location, assigned, response };
  const saved = await answerRequest(request.id, answer, user.email, seen);
  if (!saved) { refreshRequests(request.id); return { error: moved }; }
  await noticeRequestAnswered(saved, filer);
  refreshRequests(request.id);
  return { ok: `${request.status === "confirmed" ? "Changed" : "Confirmed"}, and the filer has been emailed.`, sentAt: Date.now() };
}

/** Declines a request, saying why; or marks a confirmed one done. */
export async function closeRequestAction(id: string, seen: string, outcome: "declined" | "done", note: string): Promise<ActionResult> {
  const { user, request, filer } = await requestFor(id);
  const reason = note.trim();
  if (outcome === "declined" && !reason) return { error: "Say why, so the filer knows what to do." };
  if (reason.length > 3000) return { error: "Keep the note under 3,000 characters." };
  if (outcome === "done" && request.status !== "confirmed") return { error: "Only a confirmed request can be marked done." };
  if (outcome === "declined" && request.status !== "requested" && request.status !== "confirmed") return { error: `It’s ${request.status}, so it can’t be declined.` };
  const saved = await answerRequest(request.id, { status: outcome, response: reason || request.response }, user.email, seen);
  if (!saved) { refreshRequests(request.id); return { error: moved }; }
  await noticeRequestAnswered(saved, filer);
  refreshRequests(request.id);
  return { ok: outcome === "declined" ? "Declined, and the filer has been emailed." : "Marked done." };
}

/* Petitions */

async function petitionFor(id: string) {
  const user = await requireEditor("petitions/case-docket");
  const petition = await getPetition(id);
  if (!petition || !canReadParty(user, petition.college)) notFound();
  const filer = await getAccount(petition.accountId);
  if (!filer) notFound();
  return { user, petition, filer };
}

/** Dockets a petition (or reopens a decided one), resolves it or dismisses it, with remarks the filer reads. */
export async function movePetitionAction(id: string, seen: string, status: Exclude<PetitionStatus, "filed" | "withdrawn">, note: string): Promise<ActionResult> {
  const { user, petition, filer } = await petitionFor(id);
  const remarks = note.trim();
  if (status !== "docketed" && !remarks) return { error: status === "resolved" ? "Write the resolution, so the filer knows what was decided." : "Say why it’s dismissed." };
  if (remarks.length > 6000) return { error: "Keep the remarks under 6,000 characters." };
  if (petition.status === "withdrawn") return { error: "The filer withdrew this petition." };
  if (status === "docketed" && petition.status === "docketed") return { error: "It’s already docketed." };
  if (status !== "docketed" && petition.status !== "filed" && petition.status !== "docketed") return { error: "It’s already decided. Reopen it first." };
  const saved = await movePetition(petition.id, status, remarks || petition.remarks, user.email, seen);
  if (!saved) {
    revalidatePath(`/portal/petitions/case-docket/${petition.id}`);
    return { error: moved };
  }
  await noticePetitionMoved(saved, filer, status);
  revalidatePath("/portal/petitions/case-docket", "layout");
  return { ok: `${petition.status === "resolved" || petition.status === "dismissed" ? "Reopened and docketed" : petitionStatusLabel[status].split(",")[0]}, and the filer has been emailed.` };
}

"use server";

import { revalidatePath } from "next/cache";
import { text } from "@/lib/portal/form";
import { unitName } from "@/lib/party-portal/types";
import { requireFilingAccount, type FilingAccount } from "./session";
import {
  COMMISSIONER_LEAD_DAYS, CONSULTATION_LEAD_HOURS, CONSULTATION_MINUTES, MAX_ACTIVITY_HOURS, MAX_OPEN_REQUESTS, OFFICE_HOURS,
  canCancelRequest, canWithdrawPetition, commissionerRoles, consultationTopics, isOpenRequest, manilaInstant, requestKinds,
  type OnBehalf, type RequestKind, type RequestMode,
} from "./services";
import { noticeRequestMade } from "./services-notify";
import { cancelRequest, createRequest, getPetition, getRequest, isServicesMissing, listAccountRequests, withdrawPetition } from "./services-store";
import { addAccountNotice } from "./accounts";
import { unitsOf } from "./service-units";

// The filing portal's Services, from the filer's side: booking a consultation, asking for a
// commissioner, cancelling either, and withdrawing a petition (filing one goes through
// /filing/submit/petition, for its files). Each checks who's asking first; the unit's side is
// ./services-review-actions.ts.

export type ServiceState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; sentAt?: number } | undefined;
export type ActionResult = { ok?: string; error?: string };

/** A typed answer, without emoji or the spaces around it. */
const field = (form: FormData, name: string) => text(form, name).trim();
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const hourMs = 3_600_000;

/** Whom it's for, checked against what the account holds. */
function onBehalfOf(filing: FilingAccount, value: string): { onBehalf: OnBehalf; partyId: string | null } | null {
  if (value === "party") return filing.membership?.member.status === "active" ? { onBehalf: "party", partyId: filing.membership.party.id } : null;
  if (value === "candidacy") return filing.candidacy ? { onBehalf: "candidacy", partyId: null } : null;
  return value === "self" || value === "" ? { onBehalf: "self", partyId: null } : null;
}

type Common = { college: string; onBehalf: OnBehalf; partyId: string | null; subject: string; details: string; mode: RequestMode };

/** What both kinds of request share, with its errors. */
async function readCommon(filing: FilingAccount, form: FormData, errors: Record<string, string>): Promise<Common> {
  const units = await unitsOf(filing);
  const unit = field(form, "unit");
  const college = unit === "central" ? "" : unit;
  if (!units.includes(college) || unit === "") errors.unit = "Choose the unit.";
  const behalf = onBehalfOf(filing, field(form, "onBehalf"));
  if (!behalf) errors.onBehalf = "Choose whom it’s for.";
  const subject = field(form, "subject");
  if (!subject) errors.subject = "Fill this in.";
  else if (subject.length > 200) errors.subject = "Keep it under 200 characters.";
  const details = field(form, "details");
  if (details.length > 3000) errors.details = "Keep it under 3,000 characters.";
  const mode = field(form, "mode");
  if (mode !== "in-person" && mode !== "online") errors.mode = "Choose in person or online.";
  return { college, onBehalf: behalf?.onBehalf ?? "self", partyId: behalf?.partyId ?? null, subject, details, mode: mode === "online" ? "online" : "in-person" };
}

/** Too many waiting or coming up: the account answers those first. */
async function tooMany(accountId: string) {
  const open = (await listAccountRequests(accountId)).filter((request) => isOpenRequest(request));
  return open.length >= MAX_OPEN_REQUESTS;
}

async function save(filing: FilingAccount, kind: RequestKind, common: Common, topic: string, venue: string, startsAt: number, endsAt: number): Promise<ServiceState> {
  try {
    if (await tooMany(filing.account.id)) return { error: `You have ${MAX_OPEN_REQUESTS} requests waiting or coming up. Cancel one, or wait until one is over, to ask for another.` };
    const request = await createRequest({ accountId: filing.account.id, kind, ...common, topic, venue, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() });
    await noticeRequestMade(request, filing.account);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t save a filing portal request:", message);
    return { error: isServicesMissing(message) ? "Services aren’t set up yet. Try again later, or write to comelec@ust.edu.ph." : "Your request couldn’t be sent. Try again. Your answers are still here." };
  }
  revalidatePath("/filing", "layout");
  return { ok: `Sent to the ${unitName(common.college)}. They’ll confirm a time and a place, or tell you why they can’t. You’ll be emailed either way.`, sentAt: Date.now() };
}

/** Services → Book a consultation. In office hours, Monday to Saturday, a day ahead at least. */
export async function bookConsultation(_state: ServiceState, form: FormData): Promise<ServiceState> {
  const filing = await requireFilingAccount();
  const errors: Record<string, string> = {};
  const common = await readCommon(filing, form, errors);
  const topic = field(form, "topic");
  if (!Object.hasOwn(consultationTopics, topic)) errors.topic = "Choose what it’s about.";
  const date = field(form, "date");
  const time = field(form, "time");
  const minutes = Number(field(form, "minutes"));
  if (!isDay(date)) errors.date = "Pick a day.";
  if (!isTime(time)) errors.time = "Pick a time.";
  if (!(CONSULTATION_MINUTES as readonly number[]).includes(minutes)) errors.minutes = "Choose how long.";
  const startsAt = isDay(date) && isTime(time) ? manilaInstant(date, time) : NaN;
  const endsAt = startsAt + minutes * 60_000;
  if (!errors.date && !errors.time) {
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) errors.date = "The units meet Monday to Saturday. Pick another day.";
    else if (time < OFFICE_HOURS.opens || (!errors.minutes && endsAt > manilaInstant(date, OFFICE_HOURS.closes))) errors.time = "Pick a time between 8:00 a.m. and 5:00 p.m.";
    else if (startsAt < Date.now() + CONSULTATION_LEAD_HOURS * hourMs) errors.date = "Book a day ahead at least, so the unit can find someone to meet you.";
  }
  if (Object.keys(errors).length) return { error: "Check the highlighted answers.", fieldErrors: errors };
  return save(filing, "consultation", common, topic, "", startsAt, endsAt);
}

/** Services → Request a commissioner: three days ahead at least, for an activity of up to twelve hours. */
export async function requestCommissioner(_state: ServiceState, form: FormData): Promise<ServiceState> {
  const filing = await requireFilingAccount();
  const errors: Record<string, string> = {};
  const common = await readCommon(filing, form, errors);
  const topic = field(form, "topic");
  if (!Object.hasOwn(commissionerRoles, topic)) errors.topic = "Choose what the commissioner is asked to do.";
  const venue = field(form, "venue");
  if (!venue) errors.venue = common.mode === "online" ? "Give the platform or the meeting link." : "Give the room or the place.";
  else if (venue.length > 300) errors.venue = "Keep it under 300 characters.";
  const date = field(form, "date");
  const start = field(form, "start");
  const end = field(form, "end");
  if (!isDay(date)) errors.date = "Pick a day.";
  if (!isTime(start)) errors.start = "Pick when it starts.";
  if (!isTime(end)) errors.end = "Pick when it ends.";
  const startsAt = isDay(date) && isTime(start) ? manilaInstant(date, start) : NaN;
  const endsAt = isDay(date) && isTime(end) ? manilaInstant(date, end) : NaN;
  if (!errors.date && !errors.start && !errors.end) {
    if (endsAt <= startsAt) errors.end = "It has to end after it starts.";
    else if (endsAt - startsAt > MAX_ACTIVITY_HOURS * hourMs) errors.end = `Ask for up to ${MAX_ACTIVITY_HOURS} hours.`;
    else if (startsAt < Date.now() + COMMISSIONER_LEAD_DAYS * 24 * hourMs) errors.date = `Ask ${COMMISSIONER_LEAD_DAYS} days ahead at least, so the unit can send someone.`;
  }
  if (Object.keys(errors).length) return { error: "Check the highlighted answers.", fieldErrors: errors };
  return save(filing, "commissioner", common, topic, venue, startsAt, endsAt);
}

/** The filer cancels a request that's waiting, or confirmed and not started. */
export async function cancelMyRequest(id: string): Promise<ActionResult> {
  const { account } = await requireFilingAccount();
  const request = await getRequest(id);
  if (!request || request.accountId !== account.id) return { error: "That request isn’t yours, or it was removed." };
  if (!canCancelRequest(request)) return { error: "That request is over, or already answered, so it can’t be cancelled." };
  const cancelled = await cancelRequest(request.id, account.id);
  if (!cancelled) return { error: "That request changed meanwhile. The page now shows where it stands." };
  await addAccountNotice({ accountId: account.id, kind: `${request.kind}-cancelled`, title: `You cancelled your ${requestKinds[request.kind].noun} (${request.reference})`, actor: "You" });
  revalidatePath("/filing", "layout");
  return { ok: `Cancelled. The ${unitName(request.college)} sees it’s off.` };
}

/** The filer withdraws a petition until it's decided. */
export async function withdrawMyPetition(id: string): Promise<ActionResult> {
  const { account } = await requireFilingAccount();
  const petition = await getPetition(id);
  if (!petition || petition.accountId !== account.id) return { error: "That petition isn’t yours, or it was removed." };
  if (!canWithdrawPetition(petition)) return { error: "That petition has been decided, so it can’t be withdrawn here. Write to your Comelec unit." };
  const withdrawn = await withdrawPetition(petition.id, account.id);
  if (!withdrawn) return { error: "That petition changed meanwhile. The page now shows where it stands." };
  await addAccountNotice({ accountId: account.id, kind: "petition-withdrawn", title: `You withdrew your petition (${petition.reference})`, body: petition.subject, actor: "You" });
  revalidatePath("/filing", "layout");
  return { ok: `Withdrawn. The ${unitName(petition.college)} sees it’s withdrawn.` };
}

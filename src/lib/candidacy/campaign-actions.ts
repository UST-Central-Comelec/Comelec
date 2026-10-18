"use server";

import { revalidatePath } from "next/cache";
import { addAccountNotice } from "@/lib/filing-portal/accounts";
import { requireCandidacy } from "@/lib/filing-portal/session";
import { manilaInstant, manilaParts } from "@/lib/filing-portal/services";
import { text } from "@/lib/portal/form";
import { deleteObjects } from "@/lib/storage/r2";
import { unitName } from "@/lib/party-portal/types";
import { MAX_ACTIVITY_HOURS, NOTICE_HOURS, campaignOpen, canChangeActivity, canWithdrawMaterial, hasNotice, isActivityKind } from "./campaign";
import { cancelActivity, changeActivity, createActivity, getActivity, getMaterial, moratoriumDays, withdrawMaterial, type ActivityFields as Fields } from "./campaign-store";

// A qualified candidate's campaign, from their side: the campaign schedule (each activity added,
// changed or cancelled with the unit's five hours' notice, Elections Code Article VII, Section 1.3,
// and never on a moratorium day), and taking back a material the unit hasn't reviewed. Sending a
// material goes through /filing/submit/material, for its files. The unit's side is
// ./campaign-review-actions.ts.

export type CampaignState = { ok?: string; error?: string; fieldErrors?: Record<string, string>; sentAt?: number } | undefined;
export type ActionResult = { ok?: string; error?: string };

/** A typed answer, without emoji or the spaces around it. */
const field = (form: FormData, name: string) => text(form, name).trim();
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const closed = "Your campaign opens once the unit qualifies your candidacy.";

/** The activity's answers, checked against the Code's rules, with their errors. */
async function readActivity(form: FormData, college: string): Promise<{ fields?: Fields; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const kind = field(form, "kind");
  if (!isActivityKind(kind)) errors.kind = "Choose what kind of activity it is.";
  const title = field(form, "title");
  if (!title) errors.title = "Name the activity.";
  else if (title.length > 200) errors.title = "Keep it under 200 characters.";
  const venue = field(form, "venue");
  if (!venue) errors.venue = "Say where: the rooms, the building or the platform.";
  else if (venue.length > 300) errors.venue = "Keep it under 300 characters.";
  const details = field(form, "details");
  if (details.length > 2000) errors.details = "Keep it under 2,000 characters.";
  const date = field(form, "date");
  const start = field(form, "start");
  const end = field(form, "end");
  if (!isDay(date)) errors.date = "Pick a day.";
  if (!isTime(start)) errors.start = "Pick when it starts.";
  if (!isTime(end)) errors.end = "Pick when it ends.";
  if (errors.date || errors.start || errors.end) return { errors };
  const startsAt = manilaInstant(date, start);
  const endsAt = manilaInstant(date, end);
  if (endsAt <= startsAt) errors.end = "It has to end after it starts.";
  else if (endsAt - startsAt > MAX_ACTIVITY_HOURS * 3_600_000) errors.end = `Keep one activity to ${MAX_ACTIVITY_HOURS} hours or less.`;
  else if (!hasNotice(startsAt)) errors.start = `The unit needs ${NOTICE_HOURS} hours’ notice, not counting midnight to 6 a.m. Pick a later time.`;
  else {
    const banned = (await moratoriumDays(college)).find((day) => date >= day.start && date <= day.end);
    if (banned) errors.date = `${banned.label || "That day"} is a no-campaign day. Pick another.`;
  }
  if (Object.keys(errors).length) return { errors };
  return { fields: { kind: kind as Fields["kind"], title, venue, details, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }, errors };
}

/** Adds an activity to the schedule, or changes one (`id`, over the version opened, `seen`). Either goes to the unit for approval. */
export async function saveActivity(id: string | null, seen: string | null, _state: CampaignState, form: FormData): Promise<CampaignState> {
  const { candidacy } = await requireCandidacy();
  if (!campaignOpen(candidacy)) return { error: closed };
  const current = id ? await getActivity(id) : null;
  if (id && (!current || current.candidacyId !== candidacy.id)) return { error: "That activity isn’t on your schedule any more. Reload the page." };
  if (current && !canChangeActivity(current)) return { error: "That activity has started, or it’s cancelled or not approved, so it can’t change." };
  if (current && !hasNotice(current.startsAt)) return { error: `It starts in under ${NOTICE_HOURS} hours, so the unit can’t be given notice of a change. Write to the ${unitName(candidacy.college)}.` };
  const { fields, errors } = await readActivity(form, candidacy.college);
  if (!fields) return { error: "Check the highlighted answers.", fieldErrors: errors };
  try {
    if (current) {
      const changed = await changeActivity(current.id, candidacy.id, fields, seen ?? "");
      if (!changed) return { error: "This activity changed since you opened it. Reload the page, then change it again." };
    } else await createActivity(candidacy.id, fields);
  } catch (error) {
    console.error("Couldn’t save a campaign activity:", error instanceof Error ? error.message : error);
    return { error: "The activity couldn’t be saved. Try again. Your answers are still here." };
  }
  revalidatePath("/filing", "layout");
  return { ok: current ? `Changed, and sent to the ${unitName(candidacy.college)} for approval again.` : `Added, and sent to the ${unitName(candidacy.college)} for approval. You’ll be notified when they answer.`, sentAt: Date.now() };
}

/** Cancels an activity that hasn't started. The unit sees when, so a late one is plain. */
export async function cancelMyActivity(id: string): Promise<ActionResult> {
  const { account, candidacy } = await requireCandidacy();
  const activity = await getActivity(id);
  if (!activity || activity.candidacyId !== candidacy.id) return { error: "That activity isn’t on your schedule any more." };
  if (!canChangeActivity(activity)) return { error: "That activity has started, or it’s already cancelled." };
  if (!(await cancelActivity(activity.id, candidacy.id))) return { error: "That activity changed meanwhile. The page now shows where it stands." };
  const late = !hasNotice(activity.startsAt);
  await addAccountNotice({ accountId: account.id, kind: "campaign-activity-cancelled", title: `You cancelled “${activity.title}”`, body: `${manilaParts(activity.startsAt).join(" ")}${late ? ` · With less than ${NOTICE_HOURS} hours’ notice` : ""}`, href: "/filing/candidacy/schedule", actor: "You" });
  revalidatePath("/filing", "layout");
  return { ok: late ? `Cancelled. It was under ${NOTICE_HOURS} hours away, so tell the ${unitName(candidacy.college)} too.` : `Cancelled. The ${unitName(candidacy.college)} sees it’s off.` };
}

/** Takes back a material the unit hasn't reviewed: it's removed, with its files. */
export async function withdrawMyMaterial(id: string): Promise<ActionResult> {
  const { candidacy } = await requireCandidacy();
  const material = await getMaterial(id);
  if (!material || material.candidacyId !== candidacy.id) return { error: "That material was already removed." };
  if (!canWithdrawMaterial(material)) return { error: "The unit has reviewed it, so it can’t be taken back." };
  const removed = await withdrawMaterial(material.id, candidacy.id);
  if (!removed) return { error: "The unit reviewed it meanwhile. The page now shows its review." };
  if (removed.files.length) {
    try { await deleteObjects("private", removed.files.map((file) => file.path)); } catch { console.error("Couldn’t delete a withdrawn material’s files."); }
  }
  revalidatePath("/filing", "layout");
  return { ok: `Taken back: ${material.title}.` };
}

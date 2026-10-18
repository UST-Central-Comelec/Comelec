"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { getAccount } from "@/lib/filing-portal/accounts";
import { canReadParty } from "@/lib/polpar/store";
import { noticeCampaignReviewed } from "./campaign-notify";
import { getActivity, getMaterial, reviewActivity, reviewMaterial } from "./campaign-store";
import { getCandidacy } from "./store";

// The Comelec unit's side of a candidate's campaign (Filing of Candidacy → Campaign): approving a
// material, asking for changes or not approving it, and approving an activity on the campaign
// schedule or not. A Local unit acts only on its own college's candidates. Each review goes only
// over the version the commissioner opened, and the candidate is notified and emailed.

export type ActionResult = { ok?: string; error?: string };

const moved = "This changed since you opened it. The page now shows where it stands.";

async function ownerOf(candidacyId: string) {
  const user = await requireEditor("candidacy/campaign");
  const candidacy = await getCandidacy(candidacyId);
  if (!candidacy || !canReadParty(user, candidacy.college)) notFound();
  const candidate = await getAccount(candidacy.accountId);
  if (!candidate) notFound();
  return { user, candidacy, candidate };
}

const refresh = () => revalidatePath("/portal/candidacy/campaign", "layout");

export async function reviewMaterialAction(id: string, seen: string, outcome: "approved" | "changes" | "declined", note: string): Promise<ActionResult> {
  const material = await getMaterial(id);
  if (!material) notFound();
  const { user, candidacy, candidate } = await ownerOf(material.candidacyId);
  const feedback = note.trim();
  if (outcome !== "approved" && !feedback) return { error: outcome === "changes" ? "Say what to change, so the candidate knows what to fix." : "Say why it isn’t approved." };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters." };
  if (outcome === "approved" && candidacy.status !== "qualified") return { error: "This candidate isn’t qualified now, so their materials can’t be approved." };
  const saved = await reviewMaterial(material.id, outcome, feedback, user.email, seen);
  if (!saved) { refresh(); return { error: moved }; }
  await noticeCampaignReviewed(candidacy, candidate, { kind: "material", item: saved });
  refresh();
  return { ok: outcome === "approved" ? "Approved, and the candidate has been emailed." : outcome === "changes" ? "Sent back for changes, and the candidate has been emailed." : "Not approved, and the candidate has been emailed." };
}

export async function reviewActivityAction(id: string, seen: string, outcome: "approved" | "declined", note: string): Promise<ActionResult> {
  const activity = await getActivity(id);
  if (!activity) notFound();
  const { user, candidacy, candidate } = await ownerOf(activity.candidacyId);
  const feedback = note.trim();
  if (outcome === "declined" && !feedback) return { error: "Say why it isn’t approved, so the candidate can plan around it." };
  if (feedback.length > 3000) return { error: "Keep the feedback under 3,000 characters." };
  if (activity.status === "cancelled") return { error: "The candidate cancelled this activity." };
  if (outcome === "approved" && candidacy.status !== "qualified") return { error: "This candidate isn’t qualified now, so their schedule can’t be approved." };
  if (Date.parse(activity.endsAt) < Date.now()) return { error: "This activity is over." };
  const saved = await reviewActivity(activity.id, outcome, feedback, user.email, seen);
  if (!saved) { refresh(); return { error: moved }; }
  await noticeCampaignReviewed(candidacy, candidate, { kind: "activity", item: saved });
  refresh();
  return { ok: outcome === "approved" ? "Approved, and the candidate has been emailed." : "Not approved, and the candidate has been emailed." };
}

"use server";

import { revalidatePath } from "next/cache";
import { isCandidacyRequirement } from "@/lib/candidacy/content";
import { getCandidacyDocument, listCandidacyDocuments, removeCandidacyFile, sendCandidacyDocument, takeBackCandidacyDocument } from "@/lib/candidacy/store";
import { reachesUnit } from "@/lib/candidacy/types";
import { noticeSent } from "@/lib/party-portal/notify";
import { getSubmission, listSubmissions, removeFile, sendSubmission, takeBackSubmission } from "@/lib/party-portal/store";
import { requirements } from "@/lib/polpar/content";
import { deleteObjects } from "@/lib/storage/r2";
import { requireCandidacy, requirePartyMember } from "./session";
import { fullName, type FilingArea, type FilingDocument } from "./types";

// A document's own steps, for a party's requirements and a candidacy's alike: sending it for
// review, taking it back, removing a file. Documents change only while the application waits for
// its decision; a candidacy's, only once it reaches the unit (independent, or endorsed).

export type ActionResult = { ok?: string; error?: string };

type Target = {
  owner: string;
  by: { email: string; name: string };
  list: () => Promise<FilingDocument[]>;
  get: (requirement: string) => Promise<FilingDocument | null>;
  send: (requirement: string) => Promise<FilingDocument | null>;
  takeBack: (requirement: string) => Promise<FilingDocument | null>;
  remove: (requirement: string, path: string) => Promise<"removed" | "locked">;
  sent: (requirement: string) => Promise<void>;
};

/** Who's asking, and what they may change: an error when the documents are locked. */
async function target(area: FilingArea, requirement: string | null): Promise<Target | { error: string }> {
  if (area === "party") {
    const account = await requirePartyMember();
    if (requirement !== null && !requirements.some((item) => item.id === requirement)) return { error: "That isn’t one of the requirements." };
    if (account.party.sanction) return { error: `The party is ${account.party.sanction}, so its documents can’t change now.` };
    if (account.party.status !== "pending") return { error: "The party’s registration has been decided, so its documents can’t change now." };
    const id = account.party.id;
    const name = fullName(account.member);
    return {
      owner: id, by: { email: account.member.email, name },
      list: () => listSubmissions(id), get: (item) => getSubmission(id, item),
      send: (item) => sendSubmission(id, item, account.member.email), takeBack: (item) => takeBackSubmission(id, item),
      remove: (item, path) => removeFile(id, item, path), sent: (item) => noticeSent(account.party, item, name),
    };
  }
  const { account, candidacy } = await requireCandidacy();
  if (requirement !== null && !isCandidacyRequirement(requirement)) return { error: "That isn’t one of the requirements." };
  if (candidacy.status !== "pending") return { error: "Your candidacy has been decided, so its documents can’t change now." };
  if (!reachesUnit(candidacy)) return { error: candidacy.endorsement === "waiting" ? "Your party hasn’t endorsed your candidacy yet. You can send documents once it does." : "Your party didn’t endorse this candidacy, so its documents can’t be sent." };
  const id = candidacy.id;
  return {
    owner: id, by: { email: account.email, name: fullName(account) },
    list: () => listCandidacyDocuments(id), get: (item) => getCandidacyDocument(id, item),
    send: (item) => sendCandidacyDocument(id, item, account.email), takeBack: (item) => takeBackCandidacyDocument(id, item),
    remove: (item, path) => removeCandidacyFile(id, item, path), sent: async () => {},
  };
}

/** Sends a requirement's files for the unit's review. */
export async function sendFilingDocument(area: FilingArea, requirement: string): Promise<ActionResult> {
  const found = await target(area, requirement);
  if ("error" in found) return found;
  const current = await found.get(requirement);
  if (!current?.files.length) return { error: "Upload at least one file before sending it." };
  if (!(await found.send(requirement))) return { error: "This document was already sent or reviewed. The page now shows where it stands." };
  await found.sent(requirement);
  revalidatePath("/filing", "layout");
  return { ok: area === "party" ? "Sent for review. The party will be notified when the unit reviews it." : "Sent for review. You’ll be notified when the unit reviews it." };
}

/** Sends every document that has files and isn't sent yet, in one go. */
export async function sendReadyFilingDocuments(area: FilingArea): Promise<ActionResult> {
  const found = await target(area, null);
  if ("error" in found) return found;
  const ready = (await found.list()).filter((item) => (item.status === "draft" || item.status === "changes") && item.files.length > 0);
  if (!ready.length) return { error: "No document is ready to send. Upload its files first." };
  let sent = 0;
  for (const item of ready) {
    if (await found.send(item.requirement)) {
      sent++;
      await found.sent(item.requirement);
    }
  }
  revalidatePath("/filing", "layout");
  return sent ? { ok: `Sent ${sent} ${sent === 1 ? "document" : "documents"} for review. You’ll be notified when the unit reviews them.` } : { error: "Those documents were already sent. The page now shows where they stand." };
}

/** Takes a sent document back to change it, before the unit reviews it. */
export async function takeBackFilingDocument(area: FilingArea, requirement: string): Promise<ActionResult> {
  const found = await target(area, requirement);
  if ("error" in found) return found;
  if (!(await found.takeBack(requirement))) return { error: "The unit has already reviewed this document, so it can’t be taken back." };
  revalidatePath("/filing", "layout");
  return { ok: "Taken back. Change the files, then send it again." };
}

/** Removes one file from a requirement that isn't sent or approved. */
export async function removeFilingFile(area: FilingArea, requirement: string, path: string): Promise<ActionResult> {
  const found = await target(area, requirement);
  if ("error" in found) return found;
  const file = (await found.get(requirement))?.files.find((item) => item.path === path);
  if (!file) return { error: "That file was already removed." };
  if ((await found.remove(requirement, path)) === "locked") return { error: "This document was sent for review, so its files can’t change. Take it back first." };
  try { await deleteObjects("private", [path]); } catch { console.error("Couldn’t delete a removed file from storage."); }
  revalidatePath("/filing", "layout");
  return { ok: `Removed ${file.name}.` };
}

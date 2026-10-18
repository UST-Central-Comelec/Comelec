import { revalidatePath } from "next/cache";
import { isCandidacyRequirement } from "@/lib/candidacy/content";
import { addCandidacyFiles, candidacyBytes, getCandidacyDocument } from "@/lib/candidacy/store";
import { reachesUnit } from "@/lib/candidacy/types";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { fullName, isEditable, MAX_APPLICATION_BYTES, MAX_FILE_BYTES, MAX_FILES_PER_REQUIREMENT, type FilingDocument, type FilingFile } from "@/lib/filing-portal/types";
import { addFiles, getSubmission, partyBytes } from "@/lib/party-portal/store";
import { requirements } from "@/lib/polpar/content";
import { isR2Configured } from "@/lib/storage/r2";
import { discardFiles, filesOf, readForm, reply, sameOrigin, storeFiles } from "@/lib/filing-portal/uploads";

// Uploads a requirement's files from the filing portal: a party's (`area=party`) or the candidate's
// own (`area=candidacy`), one requirement at a time, PDF, JPG or PNG, 10 MB each. The files go to
// R2's private bucket, then onto the requirement in one statement, so two members uploading at once
// keep both. A route rather than a Server Action, whose request size is kept small (next.config.ts).

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_FILES_PER_REQUIREMENT * MAX_FILE_BYTES + 1024 * 1024;

type Destination = {
  folder: string;
  current: () => Promise<FilingDocument | null>;
  bytes: () => Promise<number>;
  add: (files: FilingFile[]) => Promise<unknown>;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Upload from the filing portal." }, 403);
  const account = await getFilingAccount();
  if (!account) return reply({ error: "Your session ended. Sign in again to upload." }, 401);
  if (!isR2Configured()) return reply({ error: "Uploads aren’t available right now. Try again later." }, 503);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return reply({ error: "Upload up to 10 files of 10 MB each at a time." }, 413);

  const uploaded: string[] = [];
  let committed = false;
  try {
    const form = await readForm(request, MAX_REQUEST_BYTES);
    const area = form.get("area");
    const requirement = form.get("requirement");
    if (typeof requirement !== "string") return reply({ error: "That isn’t one of the requirements." }, 400);

    let destination: Destination;
    if (area === "party") {
      const { membership } = account;
      if (!membership || membership.member.status !== "active") return reply({ error: "You can upload once the party’s contact person approves you." }, 403);
      if (membership.party.sanction) return reply({ error: `The party is ${membership.party.sanction}, so its documents can’t change now.` }, 409);
      if (membership.party.status !== "pending") return reply({ error: "The party’s registration has been decided, so its documents can’t change now." }, 409);
      if (!requirements.some((item) => item.id === requirement)) return reply({ error: "That isn’t one of the requirements." }, 400);
      const id = membership.party.id;
      destination = { folder: `party-portal/${id}/${requirement}`, current: () => getSubmission(id, requirement), bytes: () => partyBytes(id), add: (files) => addFiles(id, requirement, files) };
    } else if (area === "candidacy") {
      const { candidacy } = account;
      if (!candidacy) return reply({ error: "File your candidacy first." }, 403);
      if (candidacy.status !== "pending") return reply({ error: "Your candidacy has been decided, so its documents can’t change now." }, 409);
      if (!reachesUnit(candidacy)) return reply({ error: "You can upload once your party endorses your candidacy." }, 409);
      if (!isCandidacyRequirement(requirement)) return reply({ error: "That isn’t one of the requirements." }, 400);
      const id = candidacy.id;
      destination = { folder: `candidacy/${id}/${requirement}`, current: () => getCandidacyDocument(id, requirement), bytes: () => candidacyBytes(id), add: (files) => addCandidacyFiles(id, requirement, files) };
    } else return reply({ error: "Upload from the filing portal." }, 400);

    const files = filesOf(form);
    if (!files.length) return reply({ error: "Choose at least one file." }, 400);
    const current = await destination.current();
    if (current && !isEditable(current.status)) return reply({ error: "This document was sent for review, so its files can’t change. Take it back first." }, 409);
    if ((current?.files.length ?? 0) + files.length > MAX_FILES_PER_REQUIREMENT) return reply({ error: `Each requirement takes up to ${MAX_FILES_PER_REQUIREMENT} files. Remove some first.` }, 400);
    if ((await destination.bytes()) + files.reduce((sum, file) => sum + file.size, 0) > MAX_APPLICATION_BYTES) return reply({ error: "The files would go over 200 MB in all. Remove some, or make them smaller." }, 413);

    const saved = await storeFiles(files, destination.folder, fullName(account.account), uploaded);
    if ("error" in saved) return reply(saved, 400);
    if ((await destination.add(saved)) === "locked") return reply({ error: "This document was sent for review while you were uploading, so its files can’t change. Take it back first." }, 409);
    committed = true;
    revalidatePath("/filing", "layout");
    return reply({ ok: files.length === 1 ? `Uploaded ${files[0].name}.` : `Uploaded ${files.length} files.` });
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") return reply({ error: "Upload up to 10 files of 10 MB each at a time." }, 413);
    console.error("Couldn’t upload a filing document:", error instanceof Error ? error.message : error);
    return reply({ error: "The files couldn’t be uploaded. Try again." }, 503);
  } finally {
    if (!committed) await discardFiles(uploaded);
  }
}

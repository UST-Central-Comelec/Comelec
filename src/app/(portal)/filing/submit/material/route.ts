import { revalidatePath } from "next/cache";
import { MAX_MATERIAL_FILES, campaignOpen, canReviseMaterial, isMaterialKind, materialKinds, sizeProblem } from "@/lib/candidacy/campaign";
import { createMaterial, getMaterial, reviseMaterial, type MaterialFields } from "@/lib/candidacy/campaign-store";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { fullName, MAX_FILE_BYTES } from "@/lib/filing-portal/types";
import { discardFiles, filesOf, readForm, reply, sameOrigin, storeFiles } from "@/lib/filing-portal/uploads";
import { unitName } from "@/lib/party-portal/types";
import { isR2Configured } from "@/lib/storage/r2";
import { withoutEmoji } from "@/lib/forms/input";

// Candidacy → Campaign materials: sends a material for the unit's approval, with its files, or a
// revised version of one the unit asked changes to (`id`). Only a qualified candidate's, under the
// Elections Code's rules on size, placement and party materials (Article VII, Sections 5, 8 and 11).

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_MATERIAL_FILES * MAX_FILE_BYTES + 1024 * 1024;
const field = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? withoutEmoji(value).trim() : ""; };
const isLink = (value: string) => /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value);

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "Send it from the filing portal." }, 403);
  const filing = await getFilingAccount();
  if (!filing) return reply({ error: "Your session ended. Sign in again to send it." }, 401);
  const { candidacy, account } = filing;
  if (!candidacy) return reply({ error: "File your candidacy first." }, 403);
  if (!campaignOpen(candidacy)) return reply({ error: "Your campaign opens once the unit qualifies your candidacy." }, 409);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return reply({ error: `Attach up to ${MAX_MATERIAL_FILES} files of 10 MB each.` }, 413);

  const uploaded: string[] = [];
  let committed = false;
  try {
    const form = await readForm(request, MAX_REQUEST_BYTES);
    const id = field(form, "id");
    const current = id ? await getMaterial(id) : null;
    if (id && (!current || current.candidacyId !== candidacy.id)) return reply({ error: "That material was removed. Reload the page." }, 404);
    if (current && !canReviseMaterial(current)) return reply({ error: "The unit has this one already. A revised version can go once it asks for changes." }, 409);

    const kind = field(form, "kind");
    if (!isMaterialKind(kind)) return reply({ error: "Choose what kind of material it is." }, 400);
    const rule = materialKinds[kind];
    const title = field(form, "title");
    if (!title || title.length > 200) return reply({ error: "Name the material, in under 200 characters." }, 400);
    const placement = field(form, "placement");
    if (placement.length > 300) return reply({ error: "Keep where it goes under 300 characters." }, 400);
    if ((kind === "tarpaulin" || kind === "poster") && !placement) return reply({ error: "Say where it’ll be put up. The unit designates the places." }, 400);
    const link = rule.link === "none" ? "" : field(form, "link");
    if (rule.link === "required" && !link) return reply({ error: "Give the page’s address." }, 400);
    if (link && (link.length > 500 || !isLink(link))) return reply({ error: "Give the full address, starting with https://." }, 400);
    const underParty = Boolean(candidacy.partyId);
    const width = rule.size ? Number(field(form, "width")) || null : null;
    const height = rule.size ? Number(field(form, "height")) || null : null;
    const tooBig = sizeProblem(kind, underParty, width, height);
    if (tooBig) return reply({ error: tooBig }, 400);
    const showsParty = form.get("showsParty") === "on";
    if (underParty && rule.partyWide && !showsParty) return reply({ error: `A party’s ${rule.label.toLowerCase()} shows all of ${candidacy.partyName ?? "the party"}’s candidates. There are no individual ones (Article VII, Section 5).` }, 400);

    const files = filesOf(form);
    if (files.length > MAX_MATERIAL_FILES) return reply({ error: `Attach up to ${MAX_MATERIAL_FILES} files.` }, 400);
    if (rule.files === "required" && !files.length && !current?.files.length) return reply({ error: "Attach a copy of it: a PDF, JPG or PNG." }, 400);
    if (!isR2Configured() && files.length) return reply({ error: "Uploads aren’t available right now. Try again later." }, 503);

    const saved = files.length ? await storeFiles(files, `campaign/${candidacy.id}`, fullName(account), uploaded) : [];
    if ("error" in saved) return reply(saved, 400);
    const fields: MaterialFields = { kind, title, width, height, placement, link, showsParty: underParty && Boolean(rule.partyWide) && showsParty };
    if (current) {
      const revised = await reviseMaterial(current.id, candidacy.id, fields, files.length ? saved : null);
      if (!revised) return reply({ error: "The unit changed its review meanwhile. Reload the page." }, 409);
      committed = true;
      if (files.length) await discardFiles(current.files.map((file) => file.path));
    } else {
      await createMaterial(candidacy.id, fields, saved);
      committed = true;
    }
    revalidatePath("/filing", "layout");
    return reply({ ok: `${current ? "Revised version sent" : "Sent"} to the ${unitName(candidacy.college)} for approval. Don’t use it until it’s approved.` });
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") return reply({ error: `Attach up to ${MAX_MATERIAL_FILES} files of 10 MB each.` }, 413);
    console.error("Couldn’t send a campaign material:", error instanceof Error ? error.message : error);
    return reply({ error: "The material couldn’t be sent. Try again." }, 503);
  } finally {
    if (!committed) await discardFiles(uploaded);
  }
}

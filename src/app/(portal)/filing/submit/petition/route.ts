import { revalidatePath } from "next/cache";
import { withoutEmoji } from "@/lib/forms/input";
import { unitsOf } from "@/lib/filing-portal/service-units";
import { MAX_PETITION_FILES, isPetitionType } from "@/lib/filing-portal/services";
import { noticePetitionFiled } from "@/lib/filing-portal/services-notify";
import { createPetition, isServicesMissing } from "@/lib/filing-portal/services-store";
import { getFilingAccount } from "@/lib/filing-portal/session";
import { fullName, MAX_FILE_BYTES } from "@/lib/filing-portal/types";
import { discardFiles, filesOf, readForm, reply, sameOrigin, storeFiles } from "@/lib/filing-portal/uploads";
import { manilaToday } from "@/lib/events/format";
import { unitName } from "@/lib/party-portal/types";
import { isR2Configured } from "@/lib/storage/r2";

// Services → File a petition: a petition or a case, with its evidence, filed with a unit. The
// filer certifies the facts are true (a verified petition, Elections Code Article V, Section 7). The
// receipt and the unit's notice go by email (src/lib/petitions/notify.ts).

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_PETITION_FILES * MAX_FILE_BYTES + 1024 * 1024;
const field = (form: FormData, name: string) => { const value = form.get(name); return typeof value === "string" ? withoutEmoji(value).trim() : ""; };
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply({ error: "File it from the filing portal." }, 403);
  const filing = await getFilingAccount();
  if (!filing) return reply({ error: "Your session ended. Sign in again to file it. Your answers are kept on this device." }, 401);
  if (Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return reply({ error: `Attach up to ${MAX_PETITION_FILES} files of 10 MB each.` }, 413);

  const uploaded: string[] = [];
  let committed = false;
  try {
    const form = await readForm(request, MAX_REQUEST_BYTES);
    const units = await unitsOf(filing);
    const unit = field(form, "unit");
    const college = unit === "central" ? "" : unit;
    if (!unit || !units.includes(college)) return reply({ error: "Choose the unit to file it with." }, 400);
    const type = field(form, "type");
    if (!isPetitionType(type)) return reply({ error: "Choose what you’re filing." }, 400);
    const subject = field(form, "subject");
    if (!subject || subject.length > 200) return reply({ error: "Say what it’s about in a line, under 200 characters." }, 400);
    const respondent = field(form, "respondent");
    if (respondent.length > 200) return reply({ error: "Keep who it’s against under 200 characters." }, 400);
    const occurredOn = field(form, "occurredOn");
    if (occurredOn && (!isDay(occurredOn) || occurredOn > manilaToday())) return reply({ error: "Pick the day it happened: today or before." }, 400);
    const statement = field(form, "statement");
    if (statement.length < 30) return reply({ error: "Tell the unit what happened: who, what, when and where, in a few sentences." }, 400);
    if (statement.length > 8000) return reply({ error: "Keep what happened under 8,000 characters. Attach the rest as files." }, 400);
    const relief = field(form, "relief");
    if (relief.length > 2000) return reply({ error: "Keep what you ask for under 2,000 characters." }, 400);
    if (form.get("certify") !== "on") return reply({ error: "Tick the box to certify that what you wrote is true." }, 400);

    const files = filesOf(form);
    if (files.length > MAX_PETITION_FILES) return reply({ error: `Attach up to ${MAX_PETITION_FILES} files.` }, 400);
    if (files.length && !isR2Configured()) return reply({ error: "Uploads aren’t available right now. File it without attachments, and send them to the unit, or try again later." }, 503);
    const saved = files.length ? await storeFiles(files, `petitions/${filing.account.id}`, fullName(filing.account), uploaded) : [];
    if ("error" in saved) return reply(saved, 400);

    const petition = await createPetition({ accountId: filing.account.id, college, type, subject, respondent, occurredOn, statement, relief, files: saved });
    committed = true;
    await noticePetitionFiled(petition, filing.account);
    revalidatePath("/filing", "layout");
    return reply({ ok: `Filed with the ${unitName(college)} as ${petition.reference}. Your receipt is on its way by email.`, id: petition.id });
  } catch (error) {
    if (error instanceof Error && error.message === "too_large") return reply({ error: `Attach up to ${MAX_PETITION_FILES} files of 10 MB each.` }, 413);
    const message = error instanceof Error ? error.message : String(error);
    console.error("Couldn’t file a petition:", message);
    return reply({ error: isServicesMissing(message) ? "Petitions aren’t set up yet. Try again later, or write to comelec@ust.edu.ph." : "The petition couldn’t be filed. Try again. Your answers are kept on this device." }, 503);
  } finally {
    if (!committed) await discardFiles(uploaded);
  }
}

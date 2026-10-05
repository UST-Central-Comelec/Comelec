"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canSeeCollege, requireEditor } from "@/lib/auth/session";
import { deleteApplication, getApplication, isApplicationStatus, setApplicationStatus } from "@/lib/applications/admin";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { resultEmail } from "@/lib/applications/emails";
import { sendApplicationEmail } from "@/lib/applications/email-log";
import { concernOf } from "@/lib/notifications/concern";
import { text } from "./form";

/**
 * Accept, reject, or move an application back to pending review. Accepting or rejecting also
 * emails the applicant unless "Email the applicant" was unticked, or that email is switched off
 * under Email Sender → Automatic; the notice says whether it went.
 * Accepting takes one of the position's recruitment slots and is refused when none are left.
 */
/** The signed-in account, if it may manage this application: it needs the Applicants tab, and a Local account only reaches its own college's. */
async function requireApplicationAccess(id: string) {
  const user = await requireEditor("recruitment/applications");
  const application = await getApplication(id);
  if (!application || !canSeeCollege(user, application.college)) redirect("/portal/recruitment/applications");
  return { user, application };
}

export async function updateApplicationStatus(id: string, formData: FormData) {
  const { user: { name } } = await requireApplicationAccess(id);
  const status = text(formData, "status");
  if (!isApplicationStatus(status)) throw new Error("Invalid application status.");

  const updated = await setApplicationStatus(id, status, name.trim().replace(/\s+/g, " ").toUpperCase().replace(/\s+\p{L}\.(?=\s)/gu, ""));
  if (!updated) return "application-no-slots";

  // Accepting or un-accepting changed the position's slot count.
  clearApplyPageCache();
  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/slots");

  let notice = `application-${status}`;
  if ((status === "accepted" || status === "declined") && formData.get("notify") === "on") {
    const application = await getApplication(id);
    // The Central Comelec's result, or the applicant's college's Local Comelec's: by where they asked to serve.
    const sent = application ? await sendApplicationEmail(id, status === "accepted" ? "accepted" : "rejected", () => resultEmail({ ...application, concern: concernOf(application.preferredBodyId, application.college) }, status === "accepted")) : "failed";
    // "off": that email is switched off under Email Sender → Automatic, so the box that was ticked couldn't send it.
    notice += sent === "sent" ? "-emailed" : sent === "off" ? "-email-off" : "-email-failed";
  }

  revalidatePath("/portal/recruitment/applications");
  return notice;
}

/** Deletes an application straight away, instead of waiting out its 60 days. */
export async function deleteApplicationRecord(id: string) {
  await requireApplicationAccess(id);
  await deleteApplication(id);

  // It no longer holds an interview place.
  clearApplyPageCache();
  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/interviews");
  revalidatePath("/portal/recruitment/applications");
  redirect("/portal/recruitment/applications?notice=application-deleted");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canSeeCollege, requirePortalUser } from "@/lib/auth/session";
import { deleteApplication, getApplication, isApplicationStatus, setApplicationStatus } from "@/lib/applications/admin";
import { clearApplyPageCache } from "@/lib/applications/apply-cache";
import { resultEmail } from "@/lib/applications/emails";
import { sendEmail } from "@/lib/email/send";
import { text } from "./form";

/**
 * Accept, reject, or move an application back to pending review. Accepting or rejecting also
 * emails the applicant unless "Email the applicant" was unticked; the notice says whether it went.
 * Accepting takes one of the position's recruitment slots and is refused when none are left.
 */
/** The signed-in account, if it may manage this application: Local accounts only their own college's. */
async function requireApplicationAccess(id: string) {
  const user = await requirePortalUser();
  const application = await getApplication(id);
  if (!application || !canSeeCollege(user, application.college)) redirect("/portal/recruitment/applications");
  return { user, application };
}

export async function updateApplicationStatus(id: string, formData: FormData) {
  const { user: { email } } = await requireApplicationAccess(id);
  const status = text(formData, "status");
  if (!isApplicationStatus(status)) redirect(`/portal/recruitment/applications/${id}`);

  const updated = await setApplicationStatus(id, status, email);
  if (!updated) redirect(`/portal/recruitment/applications/${id}?notice=application-no-slots`);

  // Accepting or un-accepting changed the position's slot count.
  clearApplyPageCache();
  revalidatePath("/apply");
  revalidatePath("/portal/recruitment/slots");

  let notice = `application-${status}`;
  if ((status === "accepted" || status === "declined") && formData.get("notify") === "on") {
    const application = await getApplication(id);
    const sent = application ? await sendEmail(resultEmail(application, status === "accepted")) : false;
    notice += sent ? "-emailed" : "-email-failed";
  }

  revalidatePath("/portal/recruitment/applications");
  revalidatePath(`/portal/recruitment/applications/${id}`);
  redirect(`/portal/recruitment/applications/${id}?notice=${notice}`);
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

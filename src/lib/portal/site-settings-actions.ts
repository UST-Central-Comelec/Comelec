"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireExecutive } from "@/lib/auth/session";
import { MAINTENANCE_MESSAGE_MAX, getSiteSettings, saveSiteSettings } from "@/lib/site-settings/store";
import { text, type FormState } from "./form";

// The portal's Maintenance tab: taking the public website offline, and its cookie notice.
// Executives only.

const PAGE = "/portal/maintenance";

/** Every public page shows these settings (through the site's layout), and so does the portal's shell. */
function refreshEverything() {
  revalidatePath("/", "layout");
}

export async function updateMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireExecutive();

  const status = text(formData, "status");
  if (status !== "live" && status !== "maintenance") return { error: "Choose whether the website is live or under maintenance." };
  const message = text(formData, "message").trim().replace(/\s+/g, " ");
  if (message.length > MAINTENANCE_MESSAGE_MAX) return { error: "Check the highlighted fields.", fieldErrors: { message: `Keep the message under ${MAINTENANCE_MESSAGE_MAX} characters.` } };

  const maintenance = status === "maintenance";
  let notice = "maintenance-saved";
  try {
    const current = await getSiteSettings();
    if (maintenance !== current.maintenance) notice = maintenance ? "maintenance-on" : "maintenance-off";
    await saveSiteSettings({ maintenance, maintenanceMessage: message || null, ...(maintenance && !current.maintenance ? { maintenanceSince: new Date().toISOString() } : {}) }, email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the site settings." };
  }

  refreshEverything();
  redirect(`${PAGE}?notice=${notice}`);
}

export async function updateCookieNotice(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireExecutive();

  const shown = text(formData, "cookieNotice");
  if (shown !== "shown" && shown !== "hidden") return { error: "Choose whether the cookie notice is shown." };

  try {
    await saveSiteSettings({ cookieNotice: shown === "shown" }, email);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the site settings." };
  }

  refreshEverything();
  redirect(`${PAGE}?notice=cookie-notice-${shown}`);
}

/** Brings the cookie notice back once for everyone, including visitors who already dismissed it. */
export async function resetCookieNotice() {
  const { email } = await requireExecutive();
  await saveSiteSettings({ cookieNoticeResetAt: new Date().toISOString() }, email);
  refreshEverything();
  redirect(`${PAGE}?notice=cookie-notice-reset`);
}

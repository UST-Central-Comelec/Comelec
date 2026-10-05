"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { actorOf } from "@/lib/notifications/notify";
import { settingChanged } from "@/lib/notifications/settings-emails";
import { MAINTENANCE_MESSAGE_MAX, getSiteSettings, saveSiteSettings } from "@/lib/site-settings/store";
import { text, type FormState } from "./form";

// The portal's Maintenance tab: taking the public website offline, and its cookie notice.
// For accounts with the Maintenance tab. Each change is emailed to the Central Comelec.

const PAGE = "/portal/maintenance";
const SECTION = "Maintenance";

/** Every public page shows these settings (through the site's layout), and so does the portal's shell. */
function refreshEverything() {
  revalidatePath("/", "layout");
}

export async function updateMaintenance(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("maintenance");
  const { email } = user;

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

    const by = actorOf(user);
    const shown = (text: string | null) => text || "The usual wording";
    if (maintenance !== current.maintenance) {
      settingChanged({
        key: "setting-site",
        section: SECTION,
        headline: maintenance ? "The website is under maintenance" : "The website is live again",
        title: maintenance ? "The website is under *maintenance*" : "The website is *live* again",
        summary: maintenance
          ? `${by.name} put the public website under maintenance. Visitors see the maintenance page until it’s switched back to Live; the Commission Portal stays up.`
          : `${by.name} brought the public website back. Visitors see it again within a few seconds.`,
        rows: [["Website", maintenance ? "Under maintenance" : "Live"], ["Before", current.maintenance ? "Under maintenance" : "Live"], ...(maintenance ? [["Message shown", shown(message || null)] as [string, string]] : [])],
        by,
        path: PAGE,
      });
    } else if (maintenance && (message || null) !== current.maintenanceMessage) {
      settingChanged({
        key: "setting-site",
        section: SECTION,
        headline: "The maintenance page’s message changed",
        title: "Maintenance message *changed*",
        summary: `${by.name} changed what the maintenance page tells visitors. The website is still under maintenance.`,
        rows: [["Message shown", shown(message || null)], ["Before", shown(current.maintenanceMessage)]],
        by,
        path: PAGE,
      });
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the site settings." };
  }

  refreshEverything();
  redirect(`${PAGE}?notice=${notice}`);
}

export async function updateCookieNotice(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("maintenance");

  const shown = text(formData, "cookieNotice");
  if (shown !== "shown" && shown !== "hidden") return { error: "Choose whether the cookie notice is shown." };

  try {
    const current = await getSiteSettings();
    const cookieNotice = shown === "shown";
    await saveSiteSettings({ cookieNotice }, user.email);
    if (cookieNotice !== current.cookieNotice) {
      const by = actorOf(user);
      settingChanged({
        key: "setting-site",
        section: SECTION,
        headline: cookieNotice ? "The cookie notice is shown" : "The cookie notice is hidden",
        title: cookieNotice ? "Cookie notice *shown*" : "Cookie notice *hidden*",
        summary: cookieNotice ? `${by.name} switched the website’s cookie notice on. Visitors who haven’t dismissed it see it.` : `${by.name} switched the website’s cookie notice off. Visitors no longer see it.`,
        rows: [["Cookie notice", cookieNotice ? "Shown" : "Hidden"], ["Before", current.cookieNotice ? "Shown" : "Hidden"]],
        by,
        path: PAGE,
      });
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the site settings." };
  }

  refreshEverything();
  redirect(`${PAGE}?notice=cookie-notice-${shown}`);
}

/** Brings the cookie notice back once for everyone, including visitors who already dismissed it. */
export async function resetCookieNotice() {
  const user = await requireEditor("maintenance");
  await saveSiteSettings({ cookieNoticeResetAt: new Date().toISOString() }, user.email);
  const by = actorOf(user);
  settingChanged({
    key: "setting-site",
    section: SECTION,
    headline: "The cookie notice was brought back for everyone",
    title: "Cookie notice *reset*",
    summary: `${by.name} reset the website’s cookie notice. Everyone sees it once more, including visitors who had dismissed it.`,
    rows: [["Cookie notice", "Shown again to everyone"]],
    by,
    path: PAGE,
  });
  refreshEverything();
  redirect(`${PAGE}?notice=cookie-notice-reset`);
}

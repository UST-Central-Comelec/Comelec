import { z } from "zod";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, link, note, paragraph, shell, siteUrl, status, strong } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { positionsForUnit } from "./options";

const webLink = z.string().trim().max(2000).refine(value => {
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname.includes(".") && !url.username && !url.password; } catch { return false; }
}, "Enter a complete HTTPS link.");
export const onboardingSchema = z.object({
  messengerUrl: z.union([z.literal(""), webLink]),
  buttons: z.array(z.object({ title: z.string().trim().min(1, "Enter a button title.").max(100, "Keep the title within 100 characters."), url: webLink })).max(10, "Add up to 10 buttons."),
});
export type OnboardingSettings = z.infer<typeof onboardingSchema>;
export const defaultOnboarding = (): OnboardingSettings => ({ messengerUrl: "", buttons: [] });
/** "Join the Commission": opens Request access with the accepted application's details filled in, once the applicant verifies the same UST account. */
export const joinCommissionUrl = (referenceCode = "") => `${siteUrl()}/portal/login?${referenceCode ? `join=${encodeURIComponent(referenceCode)}` : "request=1"}`;

type Applicant = { email: string; firstName: string; referenceCode: string; position: string; positionId?: string; role?: string; division: string; concern: Concern };

/** The fixed acceptance format, shared by Email Sender, Applicants preview and delivery. */
export function acceptanceEmail(applicant: Applicant, settings: OnboardingSettings = defaultOnboarding(), logoSrc?: string) {
  const { concern } = applicant;
  const local = isLocalConcern(concern);
  const unit = unitOf(concern);
  const role = applicant.role || positionsForUnit(local ? concern.college : "").find(item => item.id === applicant.positionId || item.label === applicant.position)?.role || "";
  const greeting = `Hi ${greetingName(applicant.firstName)},`;
  const trackUrl = `${siteUrl()}/apply/track?ref=${encodeURIComponent(applicant.referenceCode)}`;
  const intro = `Congratulations! You’ve been accepted as ${applicant.position} in the ${unit}.`;
  const introHtml = `Congratulations! You’ve been accepted as ${strong(escape(applicant.position))} in the ${strong(escape(unit))}.`;
  const next = local ? "The unit will reach out soon with your next steps. Welcome to the commission." : "The commission will reach out soon with your next steps. Welcome to the UST Central Comelec.";
  const rows: [string, string][] = [["Position", applicant.position], ...(role ? [["Role", role] as [string, string]] : []), ...(applicant.division ? [["Division", applicant.division] as [string, string]] : []), ["Applied to", unit], ["Reference code", applicant.referenceCode]];
  const actions = [{ title: "Join the Commission", url: joinCommissionUrl(applicant.referenceCode) }, ...(settings.messengerUrl ? [{ title: "Join Messenger Group Chat", url: settings.messengerUrl }] : []), ...settings.buttons];
  const relay = relayNote(concern, "your application");
  const subject = local ? `${through("You’re in! Application result", concern)} (${applicant.referenceCode})` : `You’re in! Your Central COMELEC application (${applicant.referenceCode})`;
  return {
    to: applicant.email,
    subject,
    text: [greeting, intro, next, detailsText(rows), ...actions.map(action => `${action.title}: ${action.url}`), `Track application: ${trackUrl}`, "Questions? Reply to this email, or write to comelec@ust.edu.ph.", relay, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({ eyebrow: topicFor("Commissioner recruitment", concern), title: "Welcome to the *commission*", preheader: `You’ve been accepted as ${applicant.position}.`, logoSrc,
      blocks: [status("Accepted", "ok"), paragraph(escape(greeting)), paragraph(`${introHtml}${local ? ` This result comes to you through the ${escape(COMET)}.` : ""}`), paragraph(escape(next)), details(rows, ["Position", "Role"]), ...actions.map(action => button(action.title, action.url)), note(link(trackUrl, "Track application")), divider(), note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`), ...(relay ? [note(escape(relay))] : [])],
    }),
  };
}

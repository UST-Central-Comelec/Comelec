import { z } from "zod";
import { COMMISSION, button, choices, details, detailsText, divider, escape, greetingName, link, note, paragraph, shell, siteUrl, status, strong } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { OFFER_DAYS, formatOfferDate, offerExpiry } from "./offer";
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
/**
 * "Decline": opens the tracker from the acceptance email (`from=acceptance`) with the reference code
 * and last name filled in. It looks the application up by itself and asks them to confirm.
 */
export const declineOfferUrl = (referenceCode: string, lastName = "") =>
  `${siteUrl()}/apply/track?${new URLSearchParams({ ref: referenceCode, ...(lastName ? { last: lastName } : {}), from: "acceptance" })}`;

/** `offerExpiresAt`: when the offer lapses; previews show 14 days from now. */
type Applicant = { email: string; firstName: string; lastName?: string; referenceCode: string; position: string; positionId?: string; division: string; concern: Concern; offerExpiresAt?: string };

/** The fixed acceptance format, shared by Email Sender, Applicants preview and delivery. */
export function acceptanceEmail(applicant: Applicant, settings: OnboardingSettings = defaultOnboarding(), logoSrc?: string) {
  const { concern } = applicant;
  const local = isLocalConcern(concern);
  const unit = unitOf(concern);
  // The office as the unit calls it now, so a rename under Administrative → Database shows here too.
  const office = positionsForUnit(local ? concern.college : "").find(item => item.id === applicant.positionId || item.label === applicant.position)?.label ?? applicant.position;
  const greeting = `Hi ${greetingName(applicant.firstName)},`;
  const trackUrl = `${siteUrl()}/apply/track?ref=${encodeURIComponent(applicant.referenceCode)}`;
  const intro = `Congratulations! You’ve been accepted as ${office} in the ${unit}.`;
  const introHtml = `Congratulations! You’ve been accepted as ${strong(escape(office))} in the ${strong(escape(unit))}.`;
  const next = "To formally signify your acceptance of membership in the Commission, please confirm your decision by selecting one of the options below:";
  const deadline = formatOfferDate(applicant.offerExpiresAt ?? offerExpiry());
  const validity = `This offer is valid for ${OFFER_DAYS} days, until ${deadline}. If you haven’t joined by then, it lapses and counts as declining.`;
  const rows: [string, string][] = [["Position", office], ...(applicant.division ? [["Division", applicant.division] as [string, string]] : []), ["Applied to", unit], ["Reference code", applicant.referenceCode]];
  const join = { label: "Join the Commission", href: joinCommissionUrl(applicant.referenceCode) };
  const decline = { label: "Decline", href: declineOfferUrl(applicant.referenceCode, applicant.lastName) };
  // The unit's own links (Recruitment → Onboarding), for once they've joined.
  const actions = [...(settings.messengerUrl ? [{ title: "Join Messenger Group Chat", url: settings.messengerUrl }] : []), ...settings.buttons];
  const relay = relayNote(concern, "your application");
  const subject = local ? `${through("You’re in! Application result", concern)} (${applicant.referenceCode})` : `You’re in! Your Central COMELEC application (${applicant.referenceCode})`;
  return {
    to: applicant.email,
    subject,
    text: [greeting, intro, detailsText(rows), next, `${join.label}: ${join.href}\n${decline.label}: ${decline.href}`, validity, ...(actions.length ? ["Once you’ve joined:", ...actions.map(action => `${action.title}: ${action.url}`)] : []), `Track application: ${trackUrl}`, "Questions? Reply to this email, or write to comelec@ust.edu.ph.", relay, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({ eyebrow: topicFor("Commissioner recruitment", concern), title: "Welcome to the *commission*", preheader: `You’ve been accepted as ${office}.`, logoSrc,
      blocks: [status("Accepted", "ok"), paragraph(escape(greeting)), paragraph(`${introHtml}${local ? ` This result comes to you through the ${escape(COMET)}.` : ""}`), details(rows, ["Position", "Role"]), paragraph(escape(next)), choices(join, decline), note(escape(validity)), ...(actions.length ? [note("Once you’ve joined:"), ...actions.map(action => button(action.title, action.url))] : []), note(link(trackUrl, "Track application")), divider(), note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`), ...(relay ? [note(escape(relay))] : [])],
    }),
  };
}

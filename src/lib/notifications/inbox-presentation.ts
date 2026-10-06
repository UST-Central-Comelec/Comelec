import type { InboxMessage } from "./inbox-rules";
import { unitAbbreviations } from "@/lib/applications/options";

/** Prefer stored unit identity; support messages sent before identity was recorded. */
export function senderLabel(message: InboxMessage): string {
  if (message.senderAffiliation === "central") return "CENTRAL";
  if (message.senderAffiliation === "osa") return "OSA";
  if (message.senderCollege) return (unitAbbreviations[message.senderCollege] ?? message.senderCollege).toUpperCase();
  const college = Object.keys(unitAbbreviations).find(name => message.senderName.includes(name));
  if (college) return unitAbbreviations[college];
  if (/\bLocal Comelec\b/i.test(message.senderName)) {
    const unit = message.senderName.split("·").at(-1)?.trim();
    return unit && unit !== message.senderName ? unit.toUpperCase() : "LOCAL";
  }
  if (message.senderAffiliation === "local") return "LOCAL";
  if (/\bCentral Comelec\b/i.test(message.senderName)) return "CENTRAL";
  return message.senderName.toUpperCase();
}

/** Add local unit logo paths by their stored college name when those assets are available. */
const localUnitLogos: Record<string, string> = {};

export function announcementLogo(message: InboxMessage): string | null {
  if (message.senderAffiliation === "local") return message.senderCollege ? localUnitLogos[message.senderCollege] ?? null : null;
  if (message.senderAffiliation === "central") return "/images/central-comelec-logo.png";
  // Older announcements predate stored sender identity. Never use Central's seal for a Local unit.
  return !message.senderAffiliation && /\bCentral Comelec\b/i.test(message.senderName) && !/\bLocal Comelec\b/i.test(message.senderName) ? "/images/central-comelec-logo.png" : null;
}

export function recipientMention(message: InboxMessage): string {
  if (message.recipientMention) return message.recipientMention;
  const label = message.audienceLabel.trim();
  if (/^(All units and commissioners|All commissioners · All units(?:, with official accounts)?)$/i.test(label)) return "@everyone";
  if (label === "Test · Only you") return "@you";
  return `@${label.replace(/ commissioners$/i, "") || "Selected recipients"}`;
}

export function senderInitials(message: InboxMessage): string {
  const name = message.senderCollege || message.senderName;
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

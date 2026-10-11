import { canOpen, type PortalUser } from "@/lib/auth/session";
import { periodKinds, settingsHref } from "@/lib/periods/kinds";
import { canManageEvent, canSeeInside } from "./access";
import type { Listing } from "./options";

/**
 * Where a listing leads in the portal, and what its link says. An event opens in the portal. A unit's
 * Recruitment, Political Party Registration or Filing of Candidacy is listed while it's open, and is
 * managed from its Settings: it leads there for whoever may open them, and to its page on the
 * website for everyone else. Shared by the Events list and Secretariat → Calendar.
 */
export function listingLink(user: PortalUser, event: Listing): { href: string; label: string; external?: boolean } | null {
  const manages = canManageEvent(user, event);
  if (!event.period) return { href: `/portal/events/${event.id}`, label: manages ? "Manage" : "View" };
  if (canOpen(user, periodKinds[event.period.kind].tab) && canSeeInside(user, event)) return { href: settingsHref(event.period.kind, event), label: manages ? "Manage" : "View" };
  // Scheduled but not open yet: it has no page on the website until it opens.
  if (event.period.opensAt) return null;
  return { href: `/events/${event.id}`, label: "View", external: true };
}

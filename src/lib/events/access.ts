import type { PortalUser } from "@/lib/auth/session";
import type { CommissionEvent } from "./options";

// Who may see and manage an event in the portal. Each unit manages its own events: Central accounts
// the Central Comelec's, a Local account its own college's. Central accounts can also open every
// Local unit's events, read-only, and ask the unit for changes. A Local account never sees the
// Central Comelec's events, or another college's, in the portal.

type Viewer = Pick<PortalUser, "affiliation" | "college">;
type Organized = Pick<CommissionEvent, "organizer" | "college">;

const isOwnUnit = (user: Viewer, event: Organized) => event.organizer === "local" && user.college !== null && event.college === user.college;

export function canViewEvent(user: Viewer, event: Organized) {
  return user.affiliation === "central" || isOwnUnit(user, event);
}

/** Editing, deleting, and removing registrations. */
export function canManageEvent(user: Viewer, event: Organized) {
  return user.affiliation === "central" ? event.organizer === "central" : isOwnUnit(user, event);
}

/** The Central Comelec can ask a Local unit to change its event; the unit makes the change itself. */
export function canRequestChanges(user: Viewer, event: Organized) {
  return user.affiliation === "central" && event.organizer === "local";
}

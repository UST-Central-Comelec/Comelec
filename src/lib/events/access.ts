import type { PortalUser } from "@/lib/auth/session";
import type { CommissionEvent } from "./options";

// Who may do what with a unit's events in the portal, among those with the Events tab. The list
// shows everyone every unit's events, the Central Comelec's included, just as the website does. Each
// unit manages its own: Central accounts the Central Comelec's, a Local account its own college's,
// and an event is always added for the unit of whoever adds it. Central accounts can also read who
// signed up for a Local unit's event and ask the unit for changes; the Central Executive Board (and
// the Central Comelec's official account, which stands as it), managing Central and Local alike, can
// edit them as well. A Local account reads another unit's event without its sign-ups: those hold
// students' details, which stay with the unit that collected them and the Central Comelec. Advisers
// and Admins see what their unit sees, and manage nothing.
//
// The same rules hold for a unit's Recruitment, Political Party Registration and Filing of
// Candidacy settings (src/lib/periods/kinds.ts): a unit is passed in place of an event.

type Viewer = Pick<PortalUser, "kind" | "affiliation" | "college" | "position" | "readOnly">;
type Organized = Pick<CommissionEvent, "organizer" | "college">;

const isOwnUnit = (user: Viewer, event: Organized) => event.organizer === "local" && user.college !== null && event.college === user.college;

/** The unit an account belongs to, and adds events for. Null for a Local account with no college set. */
export function unitOfAccount(user: Pick<PortalUser, "affiliation" | "college">): Organized | null {
  if (user.affiliation !== "local") return { organizer: "central", college: null };
  return user.college ? { organizer: "local", college: user.college } : null;
}

/** Whether the event (or the unit) is the account's own unit's. */
export function isOwn(user: Viewer, event: Organized) {
  return user.affiliation === "local" ? isOwnUnit(user, event) : event.organizer === "central";
}

/** Reading who signed up for an event, and a unit's settings: Central accounts every unit's, a Local account only its own. */
export function canSeeInside(user: Viewer, event: Organized) {
  return user.affiliation !== "local" || isOwnUnit(user, event);
}

/** Editing, deleting, and removing registrations; and changing a unit's settings. */
export function canManageEvent(user: Viewer, event: Organized) {
  if (user.readOnly) return false;
  if (user.affiliation === "local") return isOwnUnit(user, event);
  return event.organizer === "central" || user.position === "executive-board";
}

/** The Central Comelec can ask a Local unit to change its event; the unit makes the change itself. */
export function canRequestChanges(user: Viewer, event: Organized) {
  return !user.readOnly && user.affiliation === "central" && event.organizer === "local";
}

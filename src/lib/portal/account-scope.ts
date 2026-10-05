// Whose accounts someone with the Accounts tab may add and manage. Free of server-only imports, so
// the account forms can offer only what the server will accept.

import { positionsFor } from "@/lib/data/accounts";
import { commissionerPositions, isViewerPosition, type AccountAffiliation, type AccountKind, type AccountPosition, type CommissionerPosition } from "@/lib/data/types";

/** Whoever is managing. An official account acts as its unit's Executive Board; an Adviser or Admin manages nobody. */
export type Manager = { kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition; college: string | null };
type Target = { kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition; college: string | null };

// Executive Board, then Executive Associate, then Deputy. Null: not a commissioner.
const rankOf = (position: AccountPosition) => {
  const rank = (commissionerPositions as readonly AccountPosition[]).indexOf(position);
  return rank === -1 ? null : rank;
};

/** Where `manager` stands among the commissioners, or null for an Adviser or Admin, who only read. */
const standingOf = (manager: Manager) => (manager.kind === "official" ? 0 : isViewerPosition(manager.position) ? null : rankOf(manager.position));

/** Whether `manager` stands as an Executive Board: on one, or a unit's official account. */
const isBoard = (manager: Manager) => standingOf(manager) === 0;

/**
 * The positions `manager` may give out under `affiliation`: its own and those below it among the
 * commissioners. Advisers and Admins are the Executive Board's to add.
 */
export function grantablePositions(manager: Manager, affiliation: AccountAffiliation): AccountPosition[] {
  const standing = standingOf(manager);
  if (standing === null) return [];
  return positionsFor(affiliation).filter((position) => {
    const rank = rankOf(position);
    return rank === null ? standing === 0 : rank >= standing;
  });
}

/** The commissioner positions `manager` may approve an access request as. */
export const grantableCommissionerPositions = (manager: Manager, affiliation: AccountAffiliation) => grantablePositions(manager, affiliation).filter((position): position is CommissionerPosition => rankOf(position) !== null);

/**
 * Nobody manages an account above their own position, and Advisers and Admins manage nobody.
 * A Central account reaches every unit; a Local account only its own college's Local Comelec.
 * Official accounts and the Office for Student Affairs' Admins are the Central Executive Board's.
 */
export function canManageAccount(manager: Manager, target: Target) {
  const standing = standingOf(manager);
  if (standing === null) return false;
  if (target.kind === "official" || target.affiliation === "osa" || target.position === "admin") return manager.affiliation === "central" && isBoard(manager);
  const rank = rankOf(target.position);
  if (rank === null ? !isBoard(manager) : rank < standing) return false;
  if (manager.affiliation === "central") return true;
  return target.affiliation === "local" && manager.college !== null && target.college === manager.college;
}

/** Whether an access request is `manager`'s to decide: the position is picked on approval, so only the unit is checked. */
export function canDecideRequest(manager: Manager, request: { affiliation: AccountAffiliation; college: string }) {
  if (standingOf(manager) === null) return false;
  return manager.affiliation === "central" || (request.affiliation === "local" && manager.college !== null && request.college === manager.college);
}

/** Whether `manager` may see that an account or request exists at all: an Adviser or Admin with the Accounts tab reads what their unit's board would manage. */
export function canSeeUnit(viewer: Pick<Manager, "affiliation" | "college">, unit: { affiliation: AccountAffiliation; college: string | null }) {
  return viewer.affiliation !== "local" || (unit.affiliation === "local" && viewer.college !== null && unit.college === viewer.college);
}

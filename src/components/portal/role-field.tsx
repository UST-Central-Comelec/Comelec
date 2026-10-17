"use client";

import { useState } from "react";
import { addedRolesFor, positionsFor, rolesFor } from "@/lib/data/accounts";
import { accountPositions, type AccountAffiliation, type AccountPosition } from "@/lib/data/types";
import { Dropdown, optionsFrom } from "./dropdown";

type Unit = { affiliation: AccountAffiliation | ""; position: AccountPosition | "" };

/**
 * Affiliation, position and role, kept in step. The roles on offer follow the other two: the
 * Executive Board's own roles, "Office of the …" for an Executive Associate, "Deputy" for a deputy,
 * and none for an Adviser or Admin. The pick is remembered as a place on the board, so moving
 * someone from the Executive Board to Executive Associate turns "Chairperson" into "Office of the
 * Chairperson". Changing the affiliation keeps the position where the new one has it; the Office
 * for Student Affairs has only Admin, so that's picked for it.
 *
 * A role the unit added (Administrative → Database → Roles) is picked where the position is, as a
 * position of its own: `choice` is "added:<name>", `position` the role it's based on, and `role` its
 * name, filled in. Moving to a unit without it clears the pick.
 */
export function useRoleChoice(initial: Unit & { role: string }, college?: string | null) {
  const [affiliation, setOwnAffiliation] = useState(initial.affiliation);
  const [position, setOwnPosition] = useState(initial.position);
  const [seat, setSeat] = useState(() => (initial.affiliation && initial.position ? rolesFor(initial.affiliation, initial.position, college).indexOf(initial.role) : -1));
  const [added, setAdded] = useState(() => (addedRolesFor(initial.affiliation, college).some((item) => item.name === initial.role && item.position === initial.position) ? initial.role : ""));
  const unitRoles = addedRolesFor(affiliation, college);

  const [previousUnit, setPreviousUnit] = useState({ affiliation, college });
  if (previousUnit.affiliation !== affiliation || previousUnit.college !== college) {
    const previousRoles = previousUnit.affiliation && position ? rolesFor(previousUnit.affiliation, position, previousUnit.college) : [];
    const nextRoles = affiliation && position ? rolesFor(affiliation, position, college) : [];
    setSeat(nextRoles.indexOf(previousRoles[seat]));
    if (added && !unitRoles.some((item) => item.name === added && item.position === position)) setAdded("");
    setPreviousUnit({ affiliation, college });
  }

  const setPosition = (next: AccountPosition | "") => {
    setOwnPosition(next);
    setAdded("");
  };
  const setAffiliation = (next: AccountAffiliation) => {
    setOwnAffiliation(next);
    const positions = positionsFor(next);
    if (position && !positions.includes(position)) setPosition(positions.length === 1 ? positions[0] : "");
    else if (!position && positions.length === 1) setPosition(positions[0]);
  };

  const options = added ? [added] : affiliation && position ? rolesFor(affiliation, position, college) : [];
  // A position with one role has it; one with none has none.
  const role = options.length === 1 ? options[0] : (options[seat] ?? "");
  const setRole = (next: string) => setSeat(options.indexOf(next));
  const setPositionAndRole = (next: AccountPosition, nextRole: string) => {
    setPosition(next);
    setSeat(affiliation ? rolesFor(affiliation, next, college).indexOf(nextRole) : -1);
  };

  const choice = added ? `added:${added}` : position;
  /** The positions to pick from, `allowed` first, then the unit's added roles based on one of them. */
  const choices = (allowed: readonly AccountPosition[], enabled: (position: AccountPosition) => boolean = () => true) => [
    ...allowed.map((value) => ({ value, label: accountPositions[value], disabled: !enabled(value) })),
    ...unitRoles.filter((item) => allowed.includes(item.position)).map((item) => ({ value: `added:${item.name}`, label: item.name, disabled: !enabled(item.position) })),
  ];
  const setChoice = (next: string) => {
    const picked = next.startsWith("added:") ? unitRoles.find((item) => `added:${item.name}` === next) : undefined;
    if (!picked) return setPositionAndRole(next as AccountPosition, "");
    setOwnPosition(picked.position);
    setAdded(picked.name);
  };

  return { affiliation, setAffiliation, position, setPosition, role, setRole, setPositionAndRole, options, choice, choices, setChoice };
}

/**
 * The Role dropdown. Before a position is picked there's nothing to choose from; a deputy's role is
 * filled in and fixed; an Adviser or Admin has none. `name` sends it with the form.
 */
export function RoleSelect({ position, role, options, onChange, name, size, label, disabled }: { position: AccountPosition | ""; role: string; options: readonly string[]; onChange: (role: string) => void; name?: string; size?: "field" | "pill"; label?: string; disabled?: boolean }) {
  if (position && options.length === 0) return <input className="is-fixed" value="None" readOnly aria-label={label} />;
  if (options.length === 1) return <input className="is-fixed" name={name} value={options[0]} readOnly aria-label={label} />;
  return <Dropdown name={name} size={size} label={label} value={role} onChange={onChange} options={optionsFrom(options)} placeholder={options.length ? "Select role" : "Pick a position first"} disabled={disabled || options.length === 0} />;
}

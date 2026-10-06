"use client";

import { useState } from "react";
import { positionsFor, rolesFor } from "@/lib/data/accounts";
import type { AccountAffiliation, AccountPosition } from "@/lib/data/types";
import { Dropdown, optionsFrom } from "./dropdown";

type Unit = { affiliation: AccountAffiliation | ""; position: AccountPosition | "" };

/**
 * Affiliation, position and role, kept in step. The roles on offer follow the other two: the
 * Executive Board's own roles, "Office of the …" for an Executive Associate, "Deputy" for a deputy,
 * and none for an Adviser or Admin. The pick is remembered as a place on the board, so moving
 * someone from the Executive Board to Executive Associate turns "Chairperson" into "Office of the
 * Chairperson". Changing the affiliation keeps the position where the new one has it; the Office
 * for Student Affairs has only Admin, so that's picked for it.
 */
export function useRoleChoice(initial: Unit & { role: string }, college?: string | null) {
  const [affiliation, setOwnAffiliation] = useState(initial.affiliation);
  const [position, setPosition] = useState(initial.position);
  const [seat, setSeat] = useState(() => (initial.affiliation && initial.position ? rolesFor(initial.affiliation, initial.position, college).indexOf(initial.role) : -1));

  const [previousUnit, setPreviousUnit] = useState({ affiliation, college });
  if (previousUnit.affiliation !== affiliation || previousUnit.college !== college) {
    const previousRoles = previousUnit.affiliation && position ? rolesFor(previousUnit.affiliation, position, previousUnit.college) : [];
    const nextRoles = affiliation && position ? rolesFor(affiliation, position, college) : [];
    setSeat(nextRoles.indexOf(previousRoles[seat]));
    setPreviousUnit({ affiliation, college });
  }

  const setAffiliation = (next: AccountAffiliation) => {
    setOwnAffiliation(next);
    const positions = positionsFor(next);
    if (position && !positions.includes(position)) setPosition(positions.length === 1 ? positions[0] : "");
    else if (!position && positions.length === 1) setPosition(positions[0]);
  };

  const options = affiliation && position ? rolesFor(affiliation, position, college) : [];
  // A position with one role has it; one with none has none.
  const role = options.length === 1 ? options[0] : (options[seat] ?? "");
  const setRole = (next: string) => setSeat(options.indexOf(next));
  const setPositionAndRole = (next: AccountPosition, nextRole: string) => {
    setPosition(next);
    setSeat(affiliation ? rolesFor(affiliation, next, college).indexOf(nextRole) : -1);
  };

  return { affiliation, setAffiliation, position, setPosition, role, setRole, setPositionAndRole, options };
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

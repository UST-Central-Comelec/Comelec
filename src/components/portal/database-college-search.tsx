"use client";

import { useId } from "react";
import { Combobox } from "@/components/combobox";
import { filterCollegeOptions } from "@/lib/applications/options";

const CENTRAL = "Central Comelec";

/**
 * Type or pick the unit whose list to show, in the list's own header. Nothing is picked at first.
 * With `central`, the Central Comelec ("" as a value) is offered before the colleges.
 */
export function DatabaseCollegeSearch({ colleges, value, onPick, central = false, label = "College or faculty" }: {
  colleges: readonly string[]; value: string | null; onPick: (unit: string) => void; central?: boolean; label?: string;
}) {
  const labelId = useId();
  const options = central ? [CENTRAL, ...colleges] : colleges;
  const shown = value === null ? "" : central && value === "" ? CENTRAL : value;
  return (
    <div className="portal-field db-picker">
      <span className="portal-visually-hidden" id={labelId}>{label}</span>
      <Combobox
        key={shown}
        name="database-college"
        options={options}
        value={shown}
        labelledBy={labelId}
        placeholder={central ? "Type or pick a unit" : "Type or pick a college or faculty"}
        filterOptions={(list, query) => [...(central && CENTRAL.toLowerCase().includes(query.trim().toLowerCase()) ? [CENTRAL] : []), ...filterCollegeOptions(list.filter((option) => option !== CENTRAL), query)]}
        emptyText="Nothing matches. Add it under Colleges & Faculties first."
        onChange={(picked) => {
          if (!picked || picked === shown || !options.includes(picked)) return;
          onPick(central && picked === CENTRAL ? "" : picked);
        }}
      />
    </div>
  );
}

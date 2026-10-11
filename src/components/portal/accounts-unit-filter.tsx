"use client";

import { useId } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Combobox } from "@/components/combobox";
import { unitAbbreviations } from "@/lib/applications/options";
import { rankUnitLabels } from "@/lib/portal/unit-filter";

export function AccountsUnitFilter({ units, value, showCentral }: { units: readonly string[]; value: string; showCentral: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const labelId = useId();
  const choices = [
    { value: "", label: "All units" },
    ...(showCentral ? [{ value: "central", label: "Central Comelec" }] : []),
    ...units.map(unit => ({ value: unit, label: unitAbbreviations[unit] ? `${unit} (${unitAbbreviations[unit]})` : unit })),
  ];
  const choose = (label: string) => {
    const option = choices.find(choice => choice.label === label);
    if (!option || option.value === value) return;
    const params = new URLSearchParams(searchParams);
    params.delete("notice");
    if (option.value) params.set("unit", option.value);
    else params.delete("unit");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  return <div className="portal-field portal-accounts-unit-filter">
    <span className="portal-visually-hidden" id={labelId}>Unit</span>
    <Combobox key={value} name="unit-filter" options={choices.map(choice => choice.label)} value={choices.find(choice => choice.value === value)?.label ?? "All units"} onChange={choose} labelledBy={labelId} placeholder="Search unit or abbreviation" filterOptions={rankUnitLabels} emptyText="No matching unit." />
  </div>;
}

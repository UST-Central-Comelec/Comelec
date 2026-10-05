"use client";

import { usePathname, useRouter } from "next/navigation";
import { Dropdown } from "./dropdown";

/**
 * Picks whose settings a Central account is looking at: the Central Comelec's, or one Local unit's.
 * Kept in the URL (?unit=, the unit's college) so it survives a reload and a save.
 */
export function UnitSwitcher({ units, value, size = "pill" }: { units: readonly string[]; value: string; size?: "pill" | "field" }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Dropdown
      size={size}
      label="Whose settings to show"
      value={value}
      onChange={(college) => router.push(college ? `${pathname}?unit=${encodeURIComponent(college)}` : pathname)}
      options={[{ value: "", label: "Central Comelec" }, ...units.map((college) => ({ value: college, label: college, group: "Local units" }))]}
    />
  );
}

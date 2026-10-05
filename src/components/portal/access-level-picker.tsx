"use client";

import { useRouter } from "next/navigation";
import { Dropdown, type DropdownOption } from "./dropdown";

/** Accounts → Access Control: which level's access is shown. Kept in the URL (?level=) so it survives a reload and a save. */
export function AccessLevelPicker({ levels, value }: { levels: DropdownOption[]; value: string }) {
  const router = useRouter();
  return <Dropdown label="Access level" value={value} onChange={(level) => router.push(`/portal/accounts/access-control?level=${level}`)} options={levels} />;
}

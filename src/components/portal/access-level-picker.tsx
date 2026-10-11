"use client";

import { useRouter } from "next/navigation";
import { Dropdown, type DropdownOption } from "./dropdown";
import { useAccessNavigation } from "./unsaved-access-guard";

/** Accounts → Access Control: which level's access is shown. Kept in the URL (?level=) so it survives a reload and a save. */
export function AccessLevelPicker({ levels, value }: { levels: DropdownOption[]; value: string }) {
  const router = useRouter();
  const navigate = useAccessNavigation();
  return <Dropdown label="Access level" value={value} onChange={(level) => {
    const href = `/portal/accounts/access-control?level=${level}`;
    if (navigate) navigate(href);
    else router.push(href);
  }} options={levels} />;
}

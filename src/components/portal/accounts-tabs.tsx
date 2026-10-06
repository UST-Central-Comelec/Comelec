import { SlidingSubtabs } from "./sliding-subtabs";
import { CalendarClock, SlidersHorizontal, UserCog } from "lucide-react";

/**
 * The Accounts tab's own subtabs: the accounts themselves; Access Control, where the Central
 * Executive Board sets what each level may open; and Expiration, the date commissioners' access
 * ends. The last two are the board's alone (`showBoardTabs`), and without them there's nothing to
 * switch between.
 */
export function AccountsTabs({ current, showBoardTabs }: { current: "accounts" | "access-control" | "expiration"; showBoardTabs: boolean }) {
  if (!showBoardTabs) return null;
  return (
    <SlidingSubtabs active={current} label="Accounts" scope="accounts" items={[
      { key: "accounts", href: "/portal/accounts", label: <><UserCog size={15} strokeWidth={1.8} aria-hidden="true" /> Accounts</> },
      { key: "access-control", href: "/portal/accounts/access-control", label: <><SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" /> Access Control</> },
      { key: "expiration", href: "/portal/accounts/expiration", label: <><CalendarClock size={15} strokeWidth={1.8} aria-hidden="true" /> Expiration</> },
    ]} />
  );
}

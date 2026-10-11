import { SlidingSubtabs } from "./sliding-subtabs";
import { CalendarClock, UserCog } from "lucide-react";

/** Accounts and the board-only expiration settings. Access Control lives in the sidebar. */
export function AccountsTabs({ current, showBoardTabs }: { current: "accounts" | "expiration"; showBoardTabs: boolean }) {
  if (!showBoardTabs) return null;
  return (
    <SlidingSubtabs active={current} label="Accounts" scope="accounts" items={[
      { key: "accounts", href: "/portal/accounts", label: <><UserCog size={15} strokeWidth={1.8} aria-hidden="true" /> Accounts</> },
      { key: "expiration", href: "/portal/accounts/expiration", label: <><CalendarClock size={15} strokeWidth={1.8} aria-hidden="true" /> Expiration</> },
    ]} />
  );
}

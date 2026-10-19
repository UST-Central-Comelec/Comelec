import { SlidingSubtabs } from "./sliding-subtabs";
import { CalendarClock, ClipboardCheck, UserCog } from "lucide-react";

/** Approvals, Accounts, and the board-only expiration settings. Access Control lives in the sidebar. */
export function AccountsTabs({ current, showBoardTabs, waiting = 0 }: { current: "approvals" | "accounts" | "expiration"; showBoardTabs: boolean; waiting?: number }) {
  return (
    <SlidingSubtabs active={current} label="Accounts" scope="accounts" keepQuery={["unit", "returnTo"]} items={[
      { key: "approvals", href: "/portal/accounts/approvals", label: <><ClipboardCheck size={15} strokeWidth={1.8} aria-hidden="true" /> Approvals{waiting > 0 && <small>{waiting}</small>}</> },
      { key: "accounts", href: "/portal/accounts", label: <><UserCog size={15} strokeWidth={1.8} aria-hidden="true" /> Accounts</> },
      ...(showBoardTabs ? [{ key: "expiration", href: "/portal/accounts/expiration", label: <><CalendarClock size={15} strokeWidth={1.8} aria-hidden="true" /> Expiration</> }] : []),
    ]} />
  );
}

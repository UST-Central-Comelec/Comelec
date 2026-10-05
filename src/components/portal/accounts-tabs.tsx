import Link from "next/link";
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
    <nav className="portal-subtabs" aria-label="Accounts">
      <Link href="/portal/accounts" aria-current={current === "accounts" ? "page" : undefined}><UserCog size={15} strokeWidth={1.8} aria-hidden="true" /> Accounts</Link>
      <Link href="/portal/accounts/access-control" aria-current={current === "access-control" ? "page" : undefined}><SlidersHorizontal size={15} strokeWidth={1.8} aria-hidden="true" /> Access Control</Link>
      <Link href="/portal/accounts/expiration" aria-current={current === "expiration" ? "page" : undefined}><CalendarClock size={15} strokeWidth={1.8} aria-hidden="true" /> Expiration</Link>
    </nav>
  );
}

import Link from "next/link";
import { readings, readingText, type NavItem, type NavStatus } from "@/components/nav/nav-data";

// What the dropdown menu (mega-menu.tsx) and the full-screen menu (mobile-sheet.tsx) both draw.

/** The inside of a menu link: its icon on a tile, with a green dot while what it leads to is open, then its name and what it's for. */
export function LinkBody({ item, status }: { item: NavItem; status: NavStatus }) {
  const live = item.status ? status[item.status].open : false;
  return (
    <>
      <span className="sh-mega-icon"><item.icon size={17} strokeWidth={1.6} aria-hidden="true" />{live && <i className="sh-live" aria-hidden="true" />}</span>
      <span className="sh-mega-text">
        <strong>{item.label}{live && <span className="visually-hidden"> (open now)</span>}</strong>
        <small>{item.description}</small>
      </span>
    </>
  );
}

/** What's open right now, as on the home page's HUD; each reading leads to its page. */
export function Readings({ status, onNavigate }: { status: NavStatus; onNavigate: () => void }) {
  return (
    <ul className="sh-hud">
      {readings.map((reading) => {
        const period = status[reading.key];
        return (
          <li key={reading.key}>
            <Link href={reading.href} className={period.open ? "is-open" : undefined} onClick={onNavigate}>
              <span>{reading.label}</span>
              <i className="sh-dot" aria-hidden="true" />
              {readingText(period, reading.closed)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

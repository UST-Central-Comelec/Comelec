"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isCurrent, sections, two, type NavStatus } from "@/components/nav/nav-data";
import { useReticle } from "@/components/nav/use-reticle";

/**
 * The footer's links: the navbar's five sections, a column each, read from the same list (nav-data.ts)
 * so the two never drift apart. The navbar's reticle locks on to the link being pointed at or focused,
 * and a green dot marks what's open right now, as in its menus.
 */
export function FooterLinks({ status }: { status: NavStatus }) {
  const pathname = usePathname();
  const { field, reticle, lock } = useReticle();

  return (
    <nav
      className="sf-links"
      aria-label="Footer"
      ref={field}
      onPointerLeave={() => lock(null)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) lock(null); }}
    >
      <span ref={reticle} className="sh-reticle" aria-hidden="true" />
      {sections.map((section, index) => (
        <div className="sf-col" key={section.id}>
          <p className="sh-label" id={`sf-${section.id}`}><b>{two(index + 1)}</b>{section.label}</p>
          <ul aria-labelledby={`sf-${section.id}`}>
            {section.items.map((item) => {
              const live = item.status ? status[item.status].open : false;
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    aria-current={isCurrent(item.href, pathname) ? "page" : undefined}
                    onPointerEnter={(event) => { if (event.pointerType === "mouse") lock(event.currentTarget); }}
                    onFocus={(event) => lock(event.currentTarget)}
                  >
                    {live ? (
                      // The dot stays with the label's last word, so it never wraps on to a line of its own.
                      <>{item.label.slice(0, item.label.lastIndexOf(" ") + 1)}<span className="sf-live">{item.label.slice(item.label.lastIndexOf(" ") + 1)}<i className="sh-live" aria-hidden="true" /></span><span className="visually-hidden"> (open now)</span></>
                    ) : item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

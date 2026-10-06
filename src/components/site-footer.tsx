import Image from "next/image";
import Link from "next/link";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { FooterLinks } from "@/components/nav/footer-links";
import { readings, readingText, type NavStatus } from "@/components/nav/nav-data";
import { NightSky } from "@/components/night-sky";
import { FACEBOOK_PAGE } from "@/lib/content";

/**
 * The footer on every public page, in the navbar's language (it wears the navbar's .sh tokens): the
 * same night sky and glass, the commission's line with its accent in the serif italic, what's open
 * right now, the navbar's five sections as columns (nav/footer-links.tsx), then the office and the
 * small print. Dark in both themes, like the navbar.
 *
 * Styled in src/app/(site)/footer.css.
 */
export function SiteFooter({ status }: { status: NavStatus }) {
  return (
    <footer className="site-footer sh sf">
      <NightSky seed={2026} count={96} meteors={false} dimAround=".sf-title, .sf-blurb, .sf-links a, .sf-office p, .sf-office address" />
      <i className="sf-edge" aria-hidden="true" />
      <div className="sf-inner">
        <div className="sf-lead">
          <div>
            <p className="sf-title">For every student. <em>For a better UST.</em></p>
            <p className="sf-blurb">The official student election commission of the University of Santo Tomas.</p>
          </div>
          {/* What's open right now, as along the foot of the navbar's menus; each reading leads to its page. */}
          <div className="sf-status">
            <p className="sh-hud-live"><span className="sh-bars" aria-hidden="true"><i /><i /><i /><i /></span>Live</p>
            <ul>
              {readings.map((reading) => {
                const period = status[reading.key];
                return (
                  <li key={reading.key}>
                    <Link href={reading.href} className={period.open ? "is-open" : undefined}>
                      <span>{reading.label}</span>
                      <i className="sh-dot" aria-hidden="true" />
                      {readingText(period, reading.closed)}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <FooterLinks status={status} />

        <div className="sf-office">
          <Link href="/" className="sh-brand">
            <span className="sh-brand-mark">
              <Image src="/images/Logo-1.png" alt="" width={42} height={42} />
              <i className="sh-brand-orbit" aria-hidden="true" />
            </span>
            <span className="sh-brand-text">
              <strong>Central Comelec</strong>
              <small>UST Central Commission on Elections</small>
            </span>
          </Link>
          <div>
            <p className="sh-label">Office</p>
            <address>Room 4F, 4th floor, UST Tan Yan Kee Student Center, University of Santo Tomas, España Boulevard, Sampaloc, Manila, Philippines</address>
          </div>
          <div>
            <p className="sh-label">Email</p>
            <p><a className="sf-email" href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph<ArrowUpRight size={14} aria-hidden="true" /></a></p>
            <p className="sh-label sf-label-next">Latest updates</p>
            <p><a className="sf-email" href={FACEBOOK_PAGE} target="_blank" rel="noreferrer">Facebook page<ArrowUpRight size={14} aria-hidden="true" /></a></p>
          </div>
        </div>

        <div className="sf-base">
          <p>© 2026 UST Central Commission on Elections</p>
          <p>University of Santo Tomas · Manila</p>
          <Link href="/cookies">Cookie policy</Link>
          <Link href="/privacy">Privacy statement</Link>
          <a className="sf-top" href="#top">Back to top<span><ArrowUp size={15} aria-hidden="true" /></span></a>
        </div>
      </div>
    </footer>
  );
}

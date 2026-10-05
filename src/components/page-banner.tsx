import type { CSSProperties, ReactNode } from "react";
import { NightSky } from "@/components/night-sky";

/** One of the readings to the banner's right: a small label over its value. */
export type BannerReading = { label: string; value: string };

/** The banner's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/**
 * The short banner that opens the site's reference pages (News, Statistics, Election Explainer): what
 * the page is, in a line, with a few readings to the right. Styled by src/app/(site)/banner-page.css,
 * inside a page whose <main> carries the `bp` class. `seed` scatters the stars, so no two pages share a sky.
 */
export function PageBanner({ eyebrow, title, lede, readings = [], seed }: { eyebrow: string; title: ReactNode; lede: ReactNode; readings?: BannerReading[]; seed: number }) {
  return (
    <header className="bp-banner" data-hero>
      <NightSky seed={seed} count={64} />
      <div className="bp-wrap bp-banner-inner">
        <div className="bp-banner-copy">
          <p className="bp-eyebrow" data-enter style={enter(0)}>{eyebrow}</p>
          <h1 className="bp-title" data-enter style={enter(1)}>{title}</h1>
          <p className="bp-lede" data-enter style={enter(2)}>{lede}</p>
        </div>
        {readings.length > 0 && (
          <dl className="bp-hud" data-enter style={enter(3)}>
            {readings.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

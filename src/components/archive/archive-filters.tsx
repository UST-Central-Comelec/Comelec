"use client";

import Link from "next/link";
import { motion } from "motion/react";

export type ArchiveFilter = { href: string; label: string; active: boolean };

/**
 * A row of archive filters in the News page's tuner: the current one sits on a solid thumb that
 * slides between them. Styled by src/app/(site)/news/news.css (nr-tuner, nr-channel).
 */
export function ArchiveFilters({ id, label, items }: { id: string; label: string; items: ArchiveFilter[] }) {
  return (
    <div className="nr-tuner ar-tuner">
      <span className="ar-tuner-label">{label}</span>
      <nav className="nr-channels" aria-label={`Filter by ${label.toLowerCase()}`}>
        {items.map((item) => (
          <Link key={item.href} href={item.href} className={`nr-channel${item.active ? " is-active" : ""}`} aria-current={item.active ? "true" : undefined} prefetch={false} scroll={false}>
            {item.active && <motion.span layoutId={`ar-thumb-${id}`} className="nr-channel-thumb" transition={{ type: "spring", stiffness: 480, damping: 38 }} />}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

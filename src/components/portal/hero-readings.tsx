"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Reading = { label: string; href: string; tone: "open" | "closing" | "waiting" | "off"; text: string };

const pageSize = 5;

export function HeroReadings({ readings }: { readings: Reading[] }) {
  const [page, setPage] = useState(0);
  const id = useId();
  const pageCount = Math.ceil(readings.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));

  if (!readings.length) return null;

  return (
    <div>
      {pageCount > 1 && (
        <nav className="portal-hud-pagination" aria-label={`Dashboard status pages, page ${currentPage + 1} of ${pageCount}`}>
          <div className="portal-hud-dots">
            {Array.from({ length: pageCount }, (_, index) => (
              <button key={index} type="button" aria-label={`Go to status page ${index + 1}`} aria-current={index === currentPage ? "page" : undefined} aria-controls={id} onClick={() => setPage(index)}>
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
          <button type="button" aria-label="Previous status page" title="Previous" aria-controls={id} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Next status page" title="Next" aria-controls={id} disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </nav>
      )}
      <div className="portal-hud-viewport" id={id}>
        <div className="portal-hud-track" style={{ transform: `translateX(-${currentPage * 100}%)` }}>
          {Array.from({ length: pageCount }, (_, index) => (
            <dl className="portal-hud" key={index} inert={index !== currentPage} aria-hidden={index !== currentPage}>
              {readings.slice(index * pageSize, (index + 1) * pageSize).map(({ label, href, tone, text }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd><Link href={href} className={`is-${tone}`} title={text}>{text}</Link></dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </div>
    </div>
  );
}

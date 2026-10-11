"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import "./portal-table-row.css";

export function PortalTableRow({ href, external, children }: { href?: string; external?: boolean; children: ReactNode }) {
  const router = useRouter();

  return <tr className={`portal-clickable-row${href ? " is-clickable" : ""}`} onClick={event => {
    if (!href || event.defaultPrevented || (event.target as Element).closest("a, button, input, select, textarea, [role='button']")) return;
    if (window.getSelection()?.toString()) return;
    if (external || event.metaKey || event.ctrlKey || event.shiftKey) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      router.push(href);
    }
  }}>{children}</tr>;
}

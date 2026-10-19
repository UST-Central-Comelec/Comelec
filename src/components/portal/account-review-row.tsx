"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { accountReviewReturnHref } from "@/lib/portal/account-review-return";

function useReviewHref(href?: string) {
  const pathname = usePathname();
  const params = useSearchParams();
  const from = accountReviewReturnHref(`${pathname}${params.size ? `?${params}` : ""}`);
  return href ? `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}` : undefined;
}

/** Keep table semantics and the links’ keyboard behavior; the rest of the row opens the same review. */
export function AccountReviewRow({ href, children }: { href?: string; children: ReactNode }) {
  const router = useRouter();
  const reviewHref = useReviewHref(href);
  return <tr className={href ? "portal-request-row is-reviewable" : undefined} onClick={event => {
    if (!href || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || window.getSelection()?.toString()) return;
    if ((event.target as Element).closest("a, button, input, select, textarea, dialog, [popover], [role=button]")) return;
    router.push(reviewHref!, { scroll: false });
  }}>{children}</tr>;
}

export function AccountReviewLink({ href, children }: { href: string; children: ReactNode }) {
  const reviewHref = useReviewHref(href);
  return <Link className="portal-row-title" href={reviewHref!} scroll={false} aria-haspopup="dialog">{children}</Link>;
}

export function AccountReviewChevron({ href, name }: { href: string; name: string }) {
  const router = useRouter();
  const reviewHref = useReviewHref(href);
  return <button type="button" className="portal-list-review" aria-haspopup="dialog" aria-label={`Review account for ${name}`} onClick={() => router.push(reviewHref!, { scroll: false })}>
    <ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}

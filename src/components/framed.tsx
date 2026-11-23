"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore, type ComponentProps, type MouseEvent, type ReactNode } from "react";

// The site can be shown inside another site's <iframe> (PORTFOLIO_ORIGINS in next.config.ts).
// Google refuses to run its sign-in inside a frame, and a cross-site frame gets none of this site's
// cookies (nor its BroadcastChannel or localStorage), so signing in there could never stick. When
// framed, everything that signs in opens in a new tab instead, where it's a first-party page.

export const FRAMED_SIGN_IN_NOTE = "Opens in a new tab to sign in";

/**
 * Whether this page is inside another site's frame. A frame of this same site (a preview inside
 * the portal) shares its cookies, so it isn't counted.
 */
export function isFramed() {
  if (typeof window === "undefined" || window.self === window.top) return false;
  try {
    return window.top?.location.origin !== window.location.origin;
  } catch {
    // Reading a cross-origin parent's location throws.
    return true;
  }
}

const subscribe = () => () => {};

/** `isFramed()` for rendering: false on the server and during hydration, then the real answer. */
export function useFramed() {
  return useSyncExternalStore(subscribe, isFramed, () => false);
}

/** Opens `url` (this page by default) in a new top-level tab. */
export function openInNewTab(url: string = window.location.href) {
  window.open(new URL(url, window.location.href).toString(), "_blank", "noopener");
}

/** The note shown beside a sign-in control while framed; nothing otherwise. */
export function FramedNote({ className = "framed-note" }: { className?: string }) {
  return useFramed() ? <p className={className}>{FRAMED_SIGN_IN_NOTE}</p> : null;
}

/**
 * A link that signs in (or needs signing in). Normally a plain Next link; while framed it opens in a
 * new tab and says so, visibly or (`note="hidden"`, for compact header buttons) as a tooltip and
 * screen-reader text.
 */
export function SignInLink({ note = "visible", children, ...props }: ComponentProps<typeof Link> & { note?: "visible" | "hidden"; children: ReactNode }) {
  const framed = useFramed();
  if (!framed) return <Link {...props}>{children}</Link>;
  return (
    <>
      <Link {...props} target="_blank" rel="noopener" title={FRAMED_SIGN_IN_NOTE}>
        {children}
        {note === "hidden" && <span className="visually-hidden"> ({FRAMED_SIGN_IN_NOTE})</span>}
      </Link>
      {note === "visible" && <span className="framed-note">{FRAMED_SIGN_IN_NOTE}</span>}
    </>
  );
}

/** Paths that sign in, start Google sign-in, or sit behind a sign-in. */
const signInPaths = [/^\/filing(\/|$)/, /^\/portal(\/|$)/, /^\/apply\/verify\/start$/, /^\/events\/[^/]+\/register\/start$/];

/**
 * Mounted in each root layout. While framed, any same-site link into a sign-in path opens in a new
 * tab rather than in the frame, so entry points that don't use `SignInLink` are covered too.
 */
export function FramedSignInGuard() {
  useEffect(() => {
    if (!isFramed()) return;
    const onClick = (event: globalThis.MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || !signInPaths.some((path) => path.test(url.pathname))) return;
      event.preventDefault();
      openInNewTab(url.href);
    };
    // Capture, so it runs before Next's <Link> navigates in place.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}

/** A click handler for a sign-in button that should leave the frame: true when it did. */
export function leaveFrameForSignIn(event?: MouseEvent) {
  if (!isFramed()) return false;
  event?.preventDefault();
  openInNewTab();
  return true;
}

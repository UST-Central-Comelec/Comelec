"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { startBridge } from "@/lib/autopilot-bridge";
import { scrollToTop } from "@/lib/scroll";
import { signInPaths } from "@/components/framed";

/**
 * Lets a portfolio in PORTFOLIO_ORIGINS demo the site live inside its frame (lib/autopilot-bridge.ts). It does
 * nothing unless the page is framed by one of those origins, and never opens anything that signs in.
 */
export function AutopilotBridge({ origins }: { origins: string[] }) {
  const router = useRouter();
  const key = origins.join(" ");
  useEffect(
    () =>
      startBridge({
        origins: key ? key.split(" ") : [],
        busy: () => Boolean(document.querySelector(".site-loader")),
        allow: (path) => !signInPaths.some((pattern) => pattern.test(path)),
        navigate: (path) => router.push(path),
        // Through Lenis (smooth-scroll.tsx), which would otherwise undo a plain window.scrollTo.
        scrollTo: (y) => scrollToTop(y),
      }),
    [key, router],
  );
  return null;
}

"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
import { PHONE_QUERY, readTheme, THEME_COLOR, THEME_COOKIE, type PortalTheme } from "@/lib/portal/theme";

const ThemeContext = createContext<{ theme: PortalTheme; toggle: (from: HTMLElement) => void } | null>(null);

/**
 * The browser's own bars follow the theme, except on a phone, where the header stays dark. The layout's
 * generateViewport sets them when the page loads.
 */
function paintBrowser(theme: PortalTheme) {
  const color = THEME_COLOR[theme === "light" && !window.matchMedia(PHONE_QUERY).matches ? "light" : "dark"];
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute("content", color);
}

/**
 * The portal's shell, which carries the theme as data-theme (portal.css turns its colours over from
 * there; the sidebar and a few cards stay dark in both). The choice is kept in a cookie so the server
 * renders the same theme on the next visit, with no flash of the other one while the page loads.
 */
export function PortalShell({ initialTheme, children }: { initialTheme: PortalTheme; children: ReactNode }) {
  // In the browser the cookie has the last word: the router can bring this layout back from its cache,
  // rendered before the theme was last changed.
  const [theme, setTheme] = useState(() => (typeof document === "undefined" ? initialTheme : readTheme(document.cookie.match(`(?:^|; )${THEME_COOKIE}=(\\w+)`)?.[1] ?? initialTheme)));

  useEffect(() => {
    paintBrowser(theme);
    // Signing out leads to the sign-in page, which is always dark.
    return () => paintBrowser("dark");
  }, [theme]);

  /** `from` is the switch that was pressed: daylight spreads out from it, and draws back into it. */
  const toggle = (from: HTMLElement) => {
    const next: PortalTheme = theme === "light" ? "dark" : "light";
    document.cookie = `${THEME_COOKIE}=${next}; path=/portal; max-age=31536000; samesite=lax`;
    // Synchronously, so the browser's snapshot of the new page really is the new theme.
    const apply = () => flushSync(() => setTheme(next));
    if (!("startViewTransition" in document)) return apply();

    const root = document.documentElement;
    // With reduced motion the browser's plain cross-fade stands in for the reveal.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const box = from.getBoundingClientRect();
      const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
      root.style.setProperty("--p-reveal-x", `${x}px`);
      root.style.setProperty("--p-reveal-y", `${y}px`);
      // As far as the farthest corner of the window.
      root.style.setProperty("--p-reveal-reach", `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
      root.dataset.themeSwitch = next;
    }
    // A second press cuts the first reveal short; only the latest one clears the marker.
    void document.startViewTransition(apply).finished.finally(() => {
      if (root.dataset.themeSwitch === next) delete root.dataset.themeSwitch;
    });
  };

  return (
    <ThemeContext value={{ theme, toggle }}>
      <div className="portal-shell" data-theme={theme}>{children}</div>
    </ThemeContext>
  );
}

/** The sun-and-moon switch: in the top bar, and in the bar the sidebar becomes on a phone. */
export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (!context) return null;
  const light = context.theme === "light";

  return (
    <button className="portal-theme-toggle" type="button" role="switch" aria-checked={light} aria-label="Light theme" title={light ? "Switch to dark theme" : "Switch to light theme"} onClick={(event) => context.toggle(event.currentTarget)}>
      <span className="portal-theme-thumb" aria-hidden="true" />
      <Sun size={14} strokeWidth={2.2} aria-hidden="true" />
      <Moon size={14} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}

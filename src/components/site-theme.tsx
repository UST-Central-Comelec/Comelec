"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { ThemeToggleButton } from "@/components/theme-toggle";
import { readSiteTheme, SITE_THEME_KEY, type SiteTheme } from "@/lib/site-theme";

/**
 * The site's theme lives on <html> as data-theme (restored in a layout effect during hydration),
 * and the stylesheets turn their colours over from there. Only what's below a page's banner turns: the
 * home page, the banners, the navbar and its menus, the search and the footer are dark in both.
 */

const CHANGED = "site-theme-change";

const stored = (): SiteTheme => {
  try {
    return readSiteTheme(localStorage.getItem(SITE_THEME_KEY));
  } catch {
    // Storage is blocked: the theme lasts as long as the page does.
    return readSiteTheme(document.documentElement.dataset.theme);
  }
};

const paint = (theme: SiteTheme) => {
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
};

function subscribe(notify: () => void) {
  // Another tab changing it changes this one too.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== SITE_THEME_KEY) return;
    paint(stored());
    notify();
  };
  window.addEventListener(CHANGED, notify);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGED, notify);
    window.removeEventListener("storage", handleStorage);
  };
}

const current = () => readSiteTheme(document.documentElement.dataset.theme);

/** `from` is the switch that was pressed: daylight spreads out from it, and draws back into it. */
function switchTheme(from: HTMLElement) {
  const next: SiteTheme = current() === "light" ? "dark" : "light";
  try {
    localStorage.setItem(SITE_THEME_KEY, next);
  } catch {}
  const apply = () => {
    paint(next);
    window.dispatchEvent(new Event(CHANGED));
  };
  if (!("startViewTransition" in document)) return apply();

  const root = document.documentElement;
  // With reduced motion the browser's plain cross-fade stands in for the reveal.
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const box = from.getBoundingClientRect();
    const [x, y] = [box.left + box.width / 2, box.top + box.height / 2];
    root.style.setProperty("--theme-reveal-x", `${x}px`);
    root.style.setProperty("--theme-reveal-y", `${y}px`);
    // As far as the farthest corner of the window.
    root.style.setProperty("--theme-reveal-reach", `${Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))}px`);
    root.dataset.themeSwitch = next;
  }
  // A second press cuts the first reveal short; only the latest one clears the marker.
  void document.startViewTransition(apply).finished.finally(() => {
    if (root.dataset.themeSwitch === next) delete root.dataset.themeSwitch;
  });
}

/** The shared sun/moon button in the navbar and full-screen menu. */
export function SiteThemeToggle({ className = "" }: { className?: string }) {
  // The server can't know the choice, so it says dark until the browser does.
  const theme = useSyncExternalStore(subscribe, current, () => "dark" as const);
  const light = theme === "light";

  // Restore the saved preference before React paints, including after development remounts.
  useLayoutEffect(() => {
    paint(stored());
    window.dispatchEvent(new Event(CHANGED));
  }, []);

  return (
    <ThemeToggleButton light={light} onToggle={switchTheme} className={`sh-theme${className ? ` ${className}` : ""}`} />
  );
}

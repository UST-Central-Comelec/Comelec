// Scrolling the page from code, on the site and in the portal. The site glides with Lenis
// (src/components/smooth-scroll.tsx); while it glides, a plain window.scrollTo is undone on its next
// frame, so every scroll from code goes through here. src/components/scroll-keeper.tsx uses it to keep
// the content in view when a button changes what's on the page.

type Glide = { scrollTo(target: number, options?: { immediate?: boolean; force?: boolean }): void; resize(): void };

let glide: Glide | null = null;

/** The smooth scroller, while there is one (the site's, unless motion is reduced). */
export function setGlide(next: Glide | null) {
  glide = next;
}

/** Stops a glide where it is, so a scroll from code that follows isn't carried on past it. */
export function settleScroll() {
  glide?.resize();
  glide?.scrollTo(window.scrollY, { immediate: true, force: true });
}

/**
 * How much of the top of the window the fixed or sticky bars cover: the site's header, the portal's
 * top bar. The site's header slides away while scrolling down and back on the way up, so its full
 * height counts even while it's away.
 */
export function headerOffset() {
  let bottom = 0;
  for (const bar of document.querySelectorAll<HTMLElement>(".site-header, .portal-topbar, .portal-mobile-header")) {
    const style = getComputedStyle(bar);
    if (style.position !== "fixed" && style.position !== "sticky" || !bar.offsetHeight) continue;
    bottom = Math.max(bottom, (parseFloat(style.top) || 0) + bar.offsetHeight);
  }
  return bottom;
}

/**
 * Scrolls so `element` starts just under the header, or with `center`, sits in the middle of what
 * the header leaves. Instant unless `smooth`, and never smooth when motion is reduced.
 */
export function scrollToElement(element: Element, { smooth = false, center = false }: { smooth?: boolean; center?: boolean } = {}) {
  const box = element.getBoundingClientRect();
  const header = headerOffset();
  const top = center ? box.top + window.scrollY - header - Math.max(16, (window.innerHeight - header - box.height) / 2) : box.top + window.scrollY - header - 16;
  settleScroll();
  scrollToTop(Math.max(0, top), { smooth });
}

/** Scrolls the page to `top`. */
export function scrollToTop(top = 0, { smooth = false }: { smooth?: boolean } = {}) {
  const animate = smooth && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (glide) {
    glide.resize();
    glide.scrollTo(top, { immediate: !animate, force: true });
    return;
  }
  window.scrollTo({ top, behavior: animate ? "smooth" : "instant" });
}

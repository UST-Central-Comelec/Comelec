"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import type { Featured } from "@/components/featured-carousel";
import { CommandPalette } from "@/components/nav/command-palette";
import { MegaMenu } from "@/components/nav/mega-menu";
import { MobileSheet } from "@/components/nav/mobile-sheet";
import { sectionFor, sections, type NavStatus } from "@/components/nav/nav-data";
import { useReticle } from "@/components/nav/use-reticle";
import { NightSky } from "@/components/night-sky";
import { SiteThemeToggle } from "@/components/site-theme";
import { lockScroll } from "@/components/smooth-scroll";

/**
 * The navbar on every public page, in the home page's COMET language: a night sky behind the tabs,
 * gold reticle brackets that lock on to what's open, small capital labels and a serif italic for the accents.
 *
 * At the top of a page it's a bar across the full width; as the page scrolls on past it, it
 * draws in to a floating capsule, which slips away while you scroll down and comes back when you
 * scroll up (or bring the pointer to the top of the window). Each tab opens a menu (nav/mega-menu.tsx) by hovering, or by
 * clicking, which keeps it open. Search is a dialog (nav/command-palette.tsx), also on ⌘K. Where
 * the tabs don't fit, they fold into a full-screen menu (nav/mobile-sheet.tsx). A comet runs along
 * the top of the window as far as you've read.
 *
 * Styled in src/app/(site)/header.css.
 */

/** The bar draws in to the capsule over this many px of scrolling, once the page has scrolled past it. */
const CAPSULE_OVER = 140;
/** Scrolling has to move this many px before the navbar hides or comes back, so a tremble doesn't flap it. */
const SCROLL_SLACK = 4;
/** With a menu open, the pointer has to rest on another tab this long (ms) before the menu switches to it, so crossing a tab on the way down to the menu doesn't. */
const SWITCH_DELAY = 70;
/** A menu opened by hovering waits this long (ms) after the pointer leaves the navbar before it shuts. */
const LEAVE_DELAY = 160;
/** Below this width the tabs fold into the full-screen menu. Matches header.css. */
const TABS_FROM = "(min-width: 1100px)";

const MEGA_ID = "sh-mega";
const SHEET_ID = "sh-sheet";

const order = (id: string) => sections.findIndex((section) => section.id === id);

type Menu = {
  /** The menu opened by hovering, */
  active: string | null;
  /** or by clicking its tab: that one stays open when the pointer wanders off or over other tabs, until its tab is clicked again (or a link is picked, or you click away, press Escape or scroll down). */
  locked: string | null;
  /** The menu showing, or the one last shown while it folds away. */
  displayed: string | null;
  /** Switching tabs with a menu open: the side the new links come in from. */
  entrance: "left" | "right" | null;
  /** Goes up each time a menu opens from shut. */
  opening: number;
};

type MenuAction = { type: "hover" | "toggle"; id: string } | { type: "leave" | "close" };

function show(menu: Menu, id: string): Menu {
  const open = (menu.locked ?? menu.active) !== null;
  return {
    ...menu,
    active: id,
    displayed: id,
    // Switching tabs while a menu is open slides the new links in from that tab's side. Opening from
    // shut doesn't: the panel arriving is entrance enough.
    entrance: !open ? null : menu.displayed && id !== menu.displayed ? (order(id) > order(menu.displayed) ? "right" : "left") : menu.entrance,
    opening: open ? menu.opening : menu.opening + 1,
  };
}

function menuReducer(menu: Menu, action: MenuAction): Menu {
  switch (action.type) {
    case "hover":
      return menu.locked ? menu : show(menu, action.id);
    case "toggle":
      return menu.locked === action.id ? { ...menu, active: null, locked: null } : { ...show(menu, action.id), locked: action.id };
    case "leave":
      return menu.active === null ? menu : { ...menu, active: null };
    case "close":
      return menu.active === null && menu.locked === null ? menu : { ...menu, active: null, locked: null };
  }
}

type Cover = "search" | "sheet";
type Overlay = { cover: Cover | null; session: number };

const uncovered = (overlay: Overlay): Overlay => (overlay.cover === null ? overlay : { ...overlay, cover: null });
/** Opens `cover`, or closes it if it's the one that's open. */
const toggled = (cover: Cover) => (overlay: Overlay): Overlay => (overlay.cover === cover ? uncovered(overlay) : { cover, session: overlay.session + 1 });

const never = () => () => {};

/** "⌘K" on Apple keyboards, "Ctrl K" elsewhere. The server can't tell, so it says ⌘K until the browser does. */
function useSearchShortcut() {
  return useSyncExternalStore(never, () => (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? "⌘K" : "Ctrl K"), () => "⌘K");
}

export function SiteHeader({ featured = [], status }: { featured?: Featured[]; status: NavStatus }) {
  const pathname = usePathname();
  const shortcut = useSearchShortcut();
  const [visible, setVisible] = useState(true);
  const [condensed, setCondensed] = useState(false);
  const [menu, dispatch] = useReducer(menuReducer, { active: null, locked: null, displayed: null, entrance: null, opening: 0 });
  const [featuredIndex, setFeaturedIndex] = useState(0);
  // What's over the page: the search dialog, or the full-screen menu. `session` goes up each time either opens, so it opens fresh.
  const [{ cover, session }, setOverlay] = useState<Overlay>({ cover: null, session: 0 });

  const headerRef = useRef<HTMLElement>(null);
  const auroraRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const timers = useRef<{ switching?: number; leaving?: number }>({});
  /** Whether a menu is open, for the scroll listener, which outlives any one render. */
  const menuOpenRef = useRef(false);
  const { field: tabsField, reticle: tabsReticle, lock: lockTab } = useReticle();

  // Arriving on another page closes whatever was open (Back and Forward included).
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOverlay(uncovered);
    dispatch({ type: "close" });
  }

  const shownMenu = menu.locked ?? menu.active;
  const megaOpen = visible && cover === null && shownMenu !== null;
  const currentSection = sectionFor(pathname);

  const clearTimers = () => {
    window.clearTimeout(timers.current.switching);
    window.clearTimeout(timers.current.leaving);
  };

  const closeMenu = () => {
    clearTimers();
    dispatch({ type: "close" });
  };

  const closeAll = () => {
    closeMenu();
    setOverlay(uncovered);
  };

  const openSearch = () => {
    closeMenu();
    setOverlay((overlay) => ({ cover: "search", session: overlay.session + 1 }));
  };

  const toggleSheet = () => {
    closeMenu();
    setOverlay(toggled("sheet"));
  };

  const hoverTab = (event: PointerEvent<HTMLButtonElement>, id: string) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(timers.current.switching);
    // The reticle lands on the tab right away rather than waiting for the menu to catch up (a clicked-open menu keeps it).
    if (!menu.locked) lockTab(event.currentTarget);
    if (megaOpen && id !== shownMenu) timers.current.switching = window.setTimeout(() => dispatch({ type: "hover", id }), SWITCH_DELAY);
    else dispatch({ type: "hover", id });
  };

  /** Off a tab before its menu switched in: the switch is dropped, and the reticle goes back to the tab of the menu that's showing. */
  const leaveTab = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    window.clearTimeout(timers.current.switching);
    lockTab((megaOpen && shownMenu && tabRefs.current.get(shownMenu)) || null);
  };

  /** A click on a tab is felt: the tab springs back from its press (it shrinks while held, in header.css), and the reticle's brackets snap in on it again. */
  const pressTab = (tab: HTMLElement) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    tab.animate([{ scale: 0.94 }, { scale: 1.04, offset: 0.55 }, { scale: 1 }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
    tabsReticle.current?.animate([{ scale: 1.28, opacity: 0.35 }, { scale: 1, opacity: 1 }], { duration: 480, easing: "cubic-bezier(.22,1,.36,1)" });
  };

  const focusMenu = () => requestAnimationFrame(() => document.getElementById(MEGA_ID)?.querySelector<HTMLElement>(".sh-mega-link")?.focus());

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: string, index: number) => {
    const open = megaOpen && shownMenu === id;
    // Down, or Tab from the tab of an open menu, goes into the menu; left and right move along the tabs.
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey && open)) {
      event.preventDefault();
      clearTimers();
      if (menu.locked !== id) dispatch({ type: "toggle", id });
      focusMenu();
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = sections[(index + (event.key === "ArrowRight" ? 1 : -1) + sections.length) % sections.length];
      tabRefs.current.get(next.id)?.focus();
    }
  };

  /** Tab off either end of the menu: back to its tab, or on to whatever follows that tab. */
  const leaveMenu = (direction: "back" | "on") => {
    if (!shownMenu) return;
    if (direction === "back") {
      tabRefs.current.get(shownMenu)?.focus();
      return;
    }
    const next = sections[order(shownMenu) + 1];
    closeMenu();
    (next ? tabRefs.current.get(next.id) : searchButtonRef.current)?.focus();
  };

  // The reticle sits on the tab whose menu is open.
  useEffect(() => {
    lockTab((megaOpen && shownMenu && tabRefs.current.get(shownMenu)) || null);
  }, [lockTab, megaOpen, shownMenu]);

  useEffect(() => {
    menuOpenRef.current = shownMenu !== null;
  }, [shownMenu]);

  // Once the first-load screen starts to leave (or straight away when there isn't one), the bar's pieces come in one after another.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let landed = 0;
    const ignite = () => {
      header.setAttribute("data-live", "");
      // Taken off again once they've landed, so nothing replays when the tabs come back from the full-screen menu's layout.
      landed = window.setTimeout(() => header.removeAttribute("data-live"), 2000);
    };
    if (document.querySelector(".site-loader:not(.is-leaving)")) window.addEventListener("site-loader-done", ignite, { once: true });
    else ignite();
    return () => {
      window.clearTimeout(landed);
      window.removeEventListener("site-loader-done", ignite);
    };
  }, []);

  // Scrolling: the capsule past the top of the page, hiding on the way down and coming back on the way up, and the comet's progress.
  useEffect(() => {
    let lastY = window.scrollY;
    let queued = false;
    let drawn = "";

    const update = () => {
      queued = false;
      const y = Math.max(window.scrollY, 0);
      const room = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current?.style.setProperty("--sh-progress", room > 0 ? Math.min(y / room, 1).toFixed(4) : "0");
      // It stays a full bar until the page has scrolled past its height: the strip of page it sits
      // over (the body's top padding, white whatever the page) never shows round the capsule.
      const top = headerRef.current?.offsetHeight ?? 0;
      setCondensed(y > top);
      // How far the bar has drawn in to the capsule: tied to the scroll, so it's whole again before the page reaches its top.
      const cap = Math.min(Math.max((y - top) / CAPSULE_OVER, 0), 1).toFixed(3);
      if (cap !== drawn) headerRef.current?.style.setProperty("--sh-scroll", (drawn = cap));
      if (y <= top) setVisible(true);
      else if (Math.abs(y - lastY) > SCROLL_SLACK) {
        const goingUp = y < lastY;
        setVisible(goingUp);
        if (!goingUp && menuOpenRef.current) {
          window.clearTimeout(timers.current.switching);
          dispatch({ type: "close" });
        }
      } else return;
      lastY = y;
    };
    const handleScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerType === "mouse" && event.clientY <= 72) setVisible(true);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  // ⌘K (Ctrl K) opens the search from anywhere, and closes it again.
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      window.clearTimeout(timers.current.switching);
      window.clearTimeout(timers.current.leaving);
      dispatch({ type: "close" });
      setOverlay(toggled("search"));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // A menu shuts when you click away or press Escape, which hands focus back to its tab.
  useEffect(() => {
    if (!megaOpen) return;

    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      dispatch({ type: "close" });
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (shownMenu && headerRef.current?.contains(document.activeElement)) tabRefs.current.get(shownMenu)?.focus();
      dispatch({ type: "close" });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [megaOpen, shownMenu]);

  // While the search or the full-screen menu covers the page, the page holds still.
  useEffect(() => {
    if (cover === null) return;
    lockScroll(true);
    return () => lockScroll(false);
  }, [cover]);

  // The full-screen menu: the page behind it is out of reach, Escape closes it, and so does making the window wide enough for the tabs.
  useEffect(() => {
    if (cover !== "sheet") return;

    const behind = [...document.querySelectorAll<HTMLElement>("main, .site-footer")];
    for (const element of behind) element.inert = true;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOverlay(uncovered);
      menuButtonRef.current?.focus();
    };
    const wide = window.matchMedia(TABS_FROM);
    const handleWide = () => {
      if (wide.matches) setOverlay(uncovered);
    };

    document.addEventListener("keydown", handleKeyDown);
    wide.addEventListener("change", handleWide);
    return () => {
      for (const element of behind) element.inert = false;
      document.removeEventListener("keydown", handleKeyDown);
      wide.removeEventListener("change", handleWide);
    };
  }, [cover]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      window.clearTimeout(pending.switching);
      window.clearTimeout(pending.leaving);
    };
  }, []);

  const className = ["site-header sh", visible || cover !== null ? "is-visible" : "is-hidden", condensed && cover !== "sheet" ? "is-condensed" : "", megaOpen ? "has-menu" : ""].filter(Boolean).join(" ");

  return (
    <>
      <header
        ref={headerRef}
        className={className}
        onPointerEnter={() => window.clearTimeout(timers.current.leaving)}
        onPointerLeave={() => {
          window.clearTimeout(timers.current.switching);
          timers.current.leaving = window.setTimeout(() => dispatch({ type: "leave" }), LEAVE_DELAY);
        }}
        onPointerMove={(event) => {
          // A soft light follows the pointer across the sky.
          if (event.pointerType !== "mouse") return;
          auroraRef.current?.style.setProperty("--sh-mx", `${event.clientX}px`);
          auroraRef.current?.style.setProperty("--sh-my", `${event.clientY}px`);
        }}
        onBlur={(event) => {
          // Focus moving on to the page shuts the menu; focus merely dropping (a click on the panel's own background) doesn't.
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeMenu();
        }}
      >
        <div className="sh-backdrop" aria-hidden="true">
          <NightSky dimAround=".sh-brand, .sh-tab" within=".site-header" meteors={false} />
          <i ref={auroraRef} className="sh-aurora" />
        </div>
        <i className="sh-edge" aria-hidden="true" />
        <nav className="sh-nav" aria-label="Main">
          <div className="sh-bar">
            <Link href="/" className="sh-brand" onClick={closeAll}>
              <span className="sh-brand-mark">
                <Image src="/images/Logo-1.png" alt="" width={42} height={42} priority />
                <i className="sh-brand-orbit" aria-hidden="true" />
              </span>
              <span className="sh-brand-text">
                <strong>Central Comelec</strong>
                <small>UST Central Commission on Elections</small>
              </span>
            </Link>
            <span className="sh-divider" aria-hidden="true" />
            <div className="sh-tabs" ref={tabsField}>
              <span ref={tabsReticle} className="sh-reticle" aria-hidden="true" />
              {sections.map((section, index) => {
                const open = megaOpen && shownMenu === section.id;
                return (
                  <button
                    key={section.id}
                    ref={(node) => {
                      if (node) tabRefs.current.set(section.id, node);
                      else tabRefs.current.delete(section.id);
                    }}
                    type="button"
                    className={`sh-tab${currentSection === section.id ? " is-current" : ""}`}
                    style={{ "--i": index } as CSSProperties}
                    aria-expanded={open}
                    aria-controls={MEGA_ID}
                    onPointerEnter={(event) => hoverTab(event, section.id)}
                    onPointerLeave={leaveTab}
                    onClick={(event) => {
                      clearTimers();
                      dispatch({ type: "toggle", id: section.id });
                      pressTab(event.currentTarget);
                    }}
                    onKeyDown={(event) => handleTabKeyDown(event, section.id, index)}
                  >
                    <span className="sh-tab-label">{section.label}</span>
                    <ChevronDown className="sh-tab-chevron" size={13} strokeWidth={1.8} aria-hidden="true" />
                    {currentSection === section.id && <span className="visually-hidden">(you are here)</span>}
                  </button>
                );
              })}
            </div>
            <div className="sh-tools">
              <button ref={searchButtonRef} type="button" className="sh-search" aria-label="Search" aria-haspopup="dialog" aria-keyshortcuts="Meta+K Control+K" onClick={openSearch}>
                <Search size={16} strokeWidth={1.8} aria-hidden="true" />
                <span>Search</span>
                <kbd>{shortcut}</kbd>
              </button>
              <SiteThemeToggle />
              <Link href="/news" className="sh-cta" onClick={closeAll}>EvoSys<ArrowUpRight size={15} aria-hidden="true" /></Link>
              <button ref={menuButtonRef} type="button" className="sh-menu-button" aria-label={cover === "sheet" ? "Close menu" : "Open menu"} aria-expanded={cover === "sheet"} aria-controls={SHEET_ID} onClick={toggleSheet}>
                <i aria-hidden="true" />
                <i aria-hidden="true" />
              </button>
            </div>
          </div>
          <MegaMenu
            id={MEGA_ID}
            open={megaOpen}
            section={sections.find((section) => section.id === menu.displayed) ?? null}
            opening={menu.opening}
            entrance={menu.entrance}
            status={status}
            pathname={pathname}
            featured={featured}
            featuredIndex={featuredIndex}
            onFeaturedIndexChange={setFeaturedIndex}
            onNavigate={closeAll}
            onExit={leaveMenu}
          />
        </nav>
      </header>
      <MobileSheet
        id={SHEET_ID}
        open={cover === "sheet"}
        session={session}
        status={status}
        pathname={pathname}
        featured={featured}
        featuredIndex={featuredIndex}
        onFeaturedIndexChange={setFeaturedIndex}
        onNavigate={closeAll}
        onSearch={openSearch}
      />
      <CommandPalette open={cover === "search"} session={session} status={status} onClose={() => setOverlay((overlay) => (overlay.cover === "search" ? uncovered(overlay) : overlay))} />
      <div className={`sh site-dim${megaOpen ? " is-on" : ""}${condensed ? "" : " is-below"}`} aria-hidden="true" />
      <div ref={progressRef} className="sh sh-progress" aria-hidden="true"><span /><i /></div>
    </>
  );
}

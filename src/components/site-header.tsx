"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { AnimateIcon } from "@/components/animate-ui/icons/icon";
import { ArrowRight } from "@/components/animate-ui/icons/arrow-right";
import { Lightbulb } from "@/components/animate-ui/icons/lightbulb";
import { Users } from "@/components/animate-ui/icons/users";
import { FeaturedCarousel, type Featured } from "@/components/featured-carousel";
import { useEffect, useRef, useState } from "react";
import type { ElementType } from "react";

type NavLink = {
  label: string;
  href: string;
  items: Array<{ label: string; href: string; description: string; icon: ElementType }>;
};

const topSearches = [
  "Election calendar",
  "Official results",
  "Elections Code",
  "Latest news",
  "Cases & Concerns",
  "Contact the commission",
];

const placeholderTerms = ["Comelec", "election updates", "official results", "Elections Code"];

const links: NavLink[] = [
  {
    label: "News",
    href: "/news",
    items: [
      { label: "Latest news", href: "/news", description: "Read the latest news from the commission", icon: ArrowRight },
      { label: "Press Releases", href: "/news?category=press-release", description: "Official statements and public announcements", icon: ArrowRight },
      { label: "Events & Activities", href: "/news?category=event", description: "Upcoming events and commission activities", icon: ArrowRight },
      { label: "Election Explainer", href: "/news?category=explainer", description: "Clear guides for every Thomasian voter", icon: Lightbulb },
    ],
  },
  {
    label: "Archive",
    href: "/archive",
    items: [
      { label: "Executive Orders", href: "/archive?type=executive-order", description: "Review official directives from the commission", icon: ArrowRight },
      { label: "Memorandums", href: "/archive?type=memorandum", description: "Read formal notices and election guidance", icon: ArrowRight },
      { label: "Resolutions", href: "/archive?type=resolution", description: "Browse adopted decisions and rulings", icon: ArrowRight },
    ],
  },
  {
    label: "Voter Info",
    href: "/about",
    items: [
      { label: "Constitution", href: "/archive?type=constitution", description: "Read the rules that guide student elections", icon: ArrowRight },
      { label: "Elections Code", href: "/archive?type=elections-code", description: "Understand the code behind the electoral process", icon: ArrowRight },
      { label: "Proclamation", href: "/archive?type=proclamation", description: "View official proclamations from the commission", icon: ArrowRight },
      { label: "Cases & Concerns", href: "/about#contact", description: "Raise concerns and review election-related cases", icon: Lightbulb },
    ],
  },
  {
    label: "The Commission",
    href: "/about",
    items: [
      { label: "Central Comelec", href: "/about#central-comelec", description: "The central body overseeing student elections", icon: Users },
      { label: "Local Comelec", href: "/about#local-comelec", description: "Local election bodies serving each college", icon: Users },
      { label: "En Banc", href: "/about#en-banc", description: "Meet the commission’s collective decision-making body", icon: Users },
      { label: "Chamber of Chairpersons", href: "/about#chamber-of-chairpersons", description: "The chairpersons of every college’s Local Comelec", icon: Users },
      { label: "Contact", href: "/about#contact", description: "Find the people and office behind the process", icon: ArrowRight },
      { label: "EvoSys", href: "/about", description: "Access the commission’s election system", icon: ArrowRight },
    ],
  },
  {
    label: "Apply",
    href: "/apply",
    items: [
      { label: "Become a Commissioner", href: "/apply", description: "Join the commission and serve the Thomasian community", icon: Users },
      { label: "Filing of Candidacy", href: "/candidacy", description: "File your candidacy for the student elections", icon: ArrowRight },
      { label: "Political Party Registration", href: "/party-registration", description: "Register a political party with the commission", icon: Users },
      { label: "Track application", href: "/apply/track", description: "Check your application’s status with your reference code", icon: ArrowRight },
    ],
  },
];

export function SiteHeader({ featured = [] }: { featured?: Featured[] }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [displayedMenu, setDisplayedMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeholderText, setPlaceholderText] = useState("");
  const [topLayer, setTopLayer] = useState<"search" | "mega">("mega");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  // A menu opened by clicking its tab stays open when the pointer wanders off or over other tabs,
  // until its tab is clicked again (or a link is picked, or you click away, press Escape or scroll down).
  const [lockedMenu, setLockedMenu] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const shownMenu = lockedMenu ?? activeMenu;
  const megaMenuOpen = visible && shownMenu !== null;

  const activateMenu = (label: string) => {
    if (lockedMenu) return;
    setTopLayer("mega");
    setActiveMenu(label);
    setDisplayedMenu(label);
  };

  const closeMenu = () => {
    setActiveMenu(null);
    setLockedMenu(null);
  };

  const toggleMenu = (label: string) => {
    setSearchOpen(false);
    if (lockedMenu === label) {
      closeMenu();
      return;
    }
    setTopLayer("mega");
    setActiveMenu(label);
    setDisplayedMenu(label);
    setLockedMenu(label);
  };

  const toggleSearch = () => {
    if (searchOpen && activeMenu !== null) setTopLayer("mega");
    else setTopLayer("search");
    setSearchOpen(!searchOpen);
  };

  useEffect(() => {
    let termIndex = 0;
    let characterIndex = 0;
    let deleting = false;
    let pauseTicks = 0;

    const timer = window.setInterval(() => {
      const term = placeholderTerms[termIndex];

      if (pauseTicks > 0) {
        pauseTicks -= 1;
        return;
      }

      if (!deleting) {
        characterIndex += 1;
        setPlaceholderText(term.slice(0, characterIndex));
        if (characterIndex === term.length) {
          deleting = true;
          pauseTicks = 14;
        }
        return;
      }

      characterIndex -= 1;
      setPlaceholderText(term.slice(0, characterIndex));
      if (characterIndex === 0) {
        deleting = false;
        termIndex = (termIndex + 1) % placeholderTerms.length;
        pauseTicks = 3;
      }
    }, 75);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchPanelRef.current?.contains(target) || searchButtonRef.current?.contains(target)) return;
      setSearchOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!megaMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setActiveMenu(null);
      setLockedMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveMenu(null);
      setLockedMenu(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [megaMenuOpen]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleSmoothScroll = (event: Event) => {
      const currentScrollY = (event as CustomEvent<number>).detail;
      const scrollingUp = currentScrollY < lastScrollY;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

      setVisible(currentScrollY < 24 || scrollingUp);
      if (!scrollingUp && currentScrollY > 24) {
        setActiveMenu(null);
        setLockedMenu(null);
        setSearchOpen(false);
      }
      setScrollProgress(scrollableHeight > 0 ? (currentScrollY / scrollableHeight) * 100 : 0);
      lastScrollY = currentScrollY;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.clientY <= 72) setVisible(true);
    };

    window.addEventListener("smooth-scroll", handleSmoothScroll);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("smooth-scroll", handleSmoothScroll);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <>
      <header ref={headerRef} className={`site-header ${topLayer}-on-top${visible ? " is-visible" : " is-hidden"}`} onMouseLeave={() => setActiveMenu(null)}>
        <div className="header-inner">
          <Link href="/" className="wordmark" onClick={() => { setOpen(false); closeMenu(); }}>
            <Image className="wordmark-logo" src="/images/Logo-1.png" alt="UST Central Comelec logo" width={42} height={42} priority />
            <span>
              <strong>CENTRAL COMELEC</strong>
              <small>UST Central Commission on Elections</small>
            </span>
          </Link>
          <span className="header-divider" aria-hidden="true" />
          <nav className={open ? "main-nav is-open" : "main-nav"} aria-label="Main navigation">
            {links.map((link) => (
              <div className={`nav-item${link.items.length ? " has-dropdown" : ""}`} key={link.label} onMouseEnter={() => activateMenu(link.label)}>
                <Link
                  href={link.href}
                  className="nav-tab"
                  aria-expanded={shownMenu === link.label}
                  onFocus={() => activateMenu(link.label)}
                  onClick={(event) => { event.preventDefault(); toggleMenu(link.label); }}
                >
                  {link.label}
                  <ChevronDown className={`nav-chevron${shownMenu === link.label ? " is-active" : ""}`} size={13} strokeWidth={1.7} aria-hidden="true" />
                </Link>
              </div>
            ))}
            <div className="nav-tools">
              <Link href="/news" className="nav-cta" onClick={() => { setOpen(false); closeMenu(); }}>
                EvoSys <span>↗</span>
              </Link>
              <button ref={searchButtonRef} className="nav-icon-button" type="button" aria-label="Search" title="Search" onClick={toggleSearch}>
                <Search size={17} strokeWidth={1.7} />
              </button>
            </div>
          </nav>
          <button className="menu-button" onClick={() => { if (open) closeMenu(); setOpen(!open); }} aria-label="Toggle menu">
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
        <div ref={searchPanelRef} className={`search-panel${searchOpen ? " is-open" : ""}`}>
          <div className="search-panel-inner">
            <div className="search-panel-heading"><span>Search</span><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button></div>
            <label className="search-field"><Search size={20} strokeWidth={1.7} /><input autoFocus={searchOpen} type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={`Search ${placeholderText}`} aria-label="Search Comelec" /></label>
            <span className="search-label">Top searches</span>
            <div className="search-suggestions">
              {topSearches.map((suggestion) => <Link key={suggestion} href="/news" onClick={() => setSearchOpen(false)}><Search size={14} strokeWidth={1.6} />{suggestion}<span>↗</span></Link>)}
            </div>
          </div>
        </div>
        <div className={`mega-layer${megaMenuOpen ? " is-open" : ""}`} onMouseEnter={() => megaMenuOpen && activeMenu && setActiveMenu(activeMenu)}>
          {links.filter((link) => link.label === displayedMenu).map((link) => (
            <div className={`mega-layer-inner item-count-${link.items.length}${featured.length ? " has-featured" : ""}`} key={link.label}>
              <div className="mega-links">
                <span className="dropdown-label">{link.label}</span>
                <div className="dropdown-grid">
                  {link.items.map((item) => (
                    <AnimateIcon key={item.label} asChild animateOnHover>
                      <Link href={item.href} onClick={() => { setOpen(false); closeMenu(); }}>
                        <item.icon className="dropdown-icon" aria-hidden="true" size={28} />
                        <span><strong>{item.label}</strong><small>{item.description}</small></span>
                      </Link>
                    </AnimateIcon>
                  ))}
                </div>
              </div>
              <FeaturedCarousel items={featured} index={featuredIndex} onIndexChange={setFeaturedIndex} playing={megaMenuOpen} onNavigate={() => { setOpen(false); closeMenu(); }} />
            </div>
          ))}
        </div>
      </header>
      <div className="site-dim" aria-hidden="true" />
      <div className={`scroll-progress${visible ? " is-header-visible" : ""}`} aria-hidden="true">
        <span style={{ width: `${scrollProgress}%` }} />
      </div>
    </>
  );
}
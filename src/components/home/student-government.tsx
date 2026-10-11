"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { ComelecBackdrop } from "./comelec-backdrop";
import { CometSky } from "./comet-sky";
import { CscBackdrop } from "./csc-backdrop";
import { Monoliths } from "./monoliths";
import { SoccBackdrop } from "./socc-backdrop";
import RiseText from "@/components/rise-text";

const bodies = [
  { short: "CSC", title: "Central Student Council", logo: "csc.png", width: 900, height: 900, href: "/constitution#article-5" },
  { short: "COMELEC", title: "Central Commission on Elections", logo: "central-comelec-black.png", width: 1000, height: 1000, href: "/about#central-comelec" },
  { short: "SOCC", title: "Student Organizations Coordinating Council", logo: "socc-black.png", width: 900, height: 315, href: "/constitution#article-15" },
];

const introductions = [
  { category: "Councils", heading: "Central Student", accent: "Council.", description: "Representing the Thomasian student body and advancing students’ rights, welfare and interests." },
  { category: "Commissions", heading: "Central Commission", accent: "on Elections.", description: "Safeguarding fair, honest and orderly student elections, so every Thomasian voice can be heard." },
  { category: "Organizations", heading: "Student Organizations", accent: "Coordinating Council.", description: "Bringing student organizations together through shared interests, participation and a stronger Thomasian community." },
];

/** The view's pieces rise in one after another each time it opens, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/** Three golden banners share the lower edge of one circle across their tops. */
export function StudentGovernment() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = hovered ?? focused;
  const introduction = active === null ? null : introductions[active];

  return (
    <section className="sg-landing" aria-labelledby="sg-title">
      <CometSky anchor="#sg-title" showComet={false} />
      <CscBackdrop active={active === 0} />
      <ComelecBackdrop active={active === 1} />
      <SoccBackdrop active={active === 2} />
      {/* Where WebGL can't run, this nebula and the stage's flat red moon stand in for the Council's scene. */}
      <div className="sg-red-horizon" aria-hidden="true">
        <span className="sg-red-nebula" />
        <span className="sg-red-nebula sg-red-nebula-wisps" />
      </div>
      <header className={`sg-intro${introduction ? " is-introducing" : ""}${active === 2 ? " is-socc" : ""}`}>
        <p className="sg-kicker sg-enter" style={enter(0)}>{introduction?.category ?? "University of Santo Tomas · Student Government"}</p>
        {/* The words rise in line by line each time the view opens, and again whenever they're swapped. */}
        <h1 id="sg-title">
          <span className="sg-title-line">
            <RiseText key={`heading-${active}`} delay={.08}>{introduction?.heading ?? "One community."}</RiseText>
          </span>
          <span className="sg-title-line is-accent">
            <RiseText key={`accent-${active}`} as="em" delay={.22}>{introduction?.accent ?? "Three pillars."}</RiseText>
          </span>
        </h1>
        <p className="sg-lede" aria-live="polite" aria-atomic="true">
          <RiseText key={`description-${active}`} delay={.4} stagger={.025} duration={.9}>
            {introduction ? introduction.description : <><strong>Representation. Electoral Integrity. Community.</strong><br />At the heart of the Thomasian community.</>}
          </RiseText>
        </p>
      </header>
      <div className="sg-stage">
        <svg className="sg-top-moon" viewBox="0 0 1200 820" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <radialGradient id="sg-moon-surface" cx="600" cy="280" r="1000" gradientUnits="userSpaceOnUse">
              <stop stopColor="#54141b" /><stop offset=".09" stopColor="#240910" /><stop offset=".3" stopColor="#0c0509" /><stop offset=".65" stopColor="#030305" />
            </radialGradient>
            <filter id="sg-moon-halo" x="-15%" y="-15%" width="130%" height="130%"><feGaussianBlur stdDeviation="26" /></filter>
            <filter id="sg-moon-rim-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          {/* The moon and pillar tops share the circle centred at (600, -720), radius 1000. */}
          <circle cx="600" cy="-720" r="1000" stroke="#bc2037" strokeWidth="36" opacity=".55" filter="url(#sg-moon-halo)" />
          <circle cx="600" cy="-720" r="1000" fill="url(#sg-moon-surface)" />
          <circle cx="600" cy="-720" r="1000" stroke="#ed4c5e" strokeWidth="12" opacity=".7" filter="url(#sg-moon-rim-glow)" />
          <circle cx="600" cy="-720" r="1000" stroke="#ffada9" strokeWidth="1.8" opacity=".8" />
        </svg>
        <svg className="sg-banners" viewBox="0 0 1200 820" preserveAspectRatio="none" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id="sg-left-gold" x1="120" y1="170" x2="420" y2="690" gradientUnits="userSpaceOnUse">
              <stop stopColor="#a65c15" /><stop offset=".45" stopColor="#dba43d" /><stop offset="1" stopColor="#edc36d" />
            </linearGradient>
            <linearGradient id="sg-middle-gold" x1="460" y1="240" x2="760" y2="690" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f6dfa0" /><stop offset=".5" stopColor="#e5b855" /><stop offset="1" stopColor="#c58b2b" />
            </linearGradient>
            <linearGradient id="sg-right-gold" x1="840" y1="250" x2="1110" y2="690" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffe9ad" /><stop offset=".55" stopColor="#edc770" /><stop offset="1" stopColor="#ba802a" />
            </linearGradient>
            <linearGradient id="sg-reflection" x1="0" y1="700" x2="0" y2="820" gradientUnits="userSpaceOnUse">
              <stop stopColor="white" stopOpacity=".22" /><stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <mask id="sg-floor-mask"><rect x="0" y="700" width="1200" height="120" fill="url(#sg-reflection)" /></mask>
            <filter id="sg-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
            <g id="sg-three-banners">
              {/* All arc endpoints lie on the circle centred at (600, -720), radius 1000. */}
              <path id="sg-pillar-0" d="M120 157.27 A1000 1000 0 0 0 360 250.77 V690 H120 Z" fill="url(#sg-left-gold)" />
              <path id="sg-pillar-1" d="M460 270.15 A1000 1000 0 0 0 740 270.15 V690 H460 Z" fill="url(#sg-middle-gold)" />
              <path id="sg-pillar-2" d="M840 250.77 A1000 1000 0 0 0 1080 157.27 V690 H840 Z" fill="url(#sg-right-gold)" />
            </g>
            <clipPath id="sg-pillar-surface"><use href="#sg-three-banners" /></clipPath>
            {bodies.map((body, index) => <clipPath key={body.short} id={`sg-pillar-clip-${index}`}><use href={`#sg-pillar-${index}`} /></clipPath>)}
            <linearGradient id="sg-shine" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#fff8df" stopOpacity="0" />
              <stop offset=".35" stopColor="#fff8df" stopOpacity=".15" />
              <stop offset=".55" stopColor="#fffdf0" stopOpacity=".95" />
              <stop offset=".68" stopColor="#fff8df" stopOpacity=".25" />
              <stop offset="1" stopColor="#fff8df" stopOpacity="0" />
            </linearGradient>
            <radialGradient id="sg-glare">
              <stop stopColor="#fff9db" stopOpacity=".65" />
              <stop offset=".4" stopColor="#ffe8a0" stopOpacity=".22" />
              <stop offset="1" stopColor="#ffe8a0" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="sg-edge-light" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#fff8dc" stopOpacity=".75" />
              <stop offset="1" stopColor="#fff8dc" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse cx="600" cy="689" rx="530" ry="35" fill="#dca949" opacity=".24" filter="url(#sg-glow)" />
          <use href="#sg-three-banners" filter="url(#sg-glow)" opacity=".22" />
          <use href="#sg-three-banners" />
          {bodies.map((body, index) => <use key={body.short} className={`sg-pillar-hover sg-pillar-hover-${index}`} href={`#sg-pillar-${index}`} />)}
          <g clipPath="url(#sg-pillar-surface)">
            <ellipse cx="145" cy="210" rx="135" ry="185" fill="url(#sg-glare)" />
            <ellipse cx="720" cy="310" rx="135" ry="165" fill="url(#sg-glare)" />
            <ellipse cx="1060" cy="205" rx="145" ry="200" fill="url(#sg-glare)" />
            <rect className="sg-pillar-shine" x="0" y="100" width="260" height="650" fill="url(#sg-shine)" />
          </g>
          {/* The banners not being pointed at settle back, so the one that is reads first. */}
          {bodies.map((body, index) => <rect key={body.short} className={`sg-pillar-dim sg-pillar-dim-${index}`} clipPath={`url(#sg-pillar-clip-${index})`} width="1200" height="820" />)}
          <path d="M121 159 V690 M739 272 V690 M1079 159 V690" stroke="url(#sg-edge-light)" strokeWidth="2" />
          <path d="M120 157.27 A1000 1000 0 0 0 360 250.77 M460 270.15 A1000 1000 0 0 0 740 270.15 M840 250.77 A1000 1000 0 0 0 1080 157.27" stroke="#fff0bf" strokeOpacity=".6" strokeWidth="1.5" />
          <g mask="url(#sg-floor-mask)"><use href="#sg-three-banners" transform="translate(0 1390) scale(1 -1)" /></g>
        </svg>
        <Monoliths active={active} />
        <div className="sg-bodies">
          {bodies.map(({ short, title, logo, width, height, href }, index) => (
            <Link className={`sg-pillar-link sg-pillar-link-${index}`} key={short} href={href} aria-label={`Learn about the ${title}`}
              onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(index); }}
              onPointerLeave={() => setHovered(null)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}>
              <article className={`sg-body sg-body-${index}`}>
                <span className="sg-crest">
                  <Image src={`/images/student-government/${logo}`} alt={`${title} logo`} width={width} height={height} sizes="(max-width: 600px) 64px, 160px" />
                </span>
                <h2>{short}</h2>
                <p>{title}</p>
                <span className="sg-body-rule" aria-hidden="true" />
                <span className="sg-body-more" aria-hidden="true">Learn more <ArrowUpRight /></span>
              </article>
            </Link>
          ))}
        </div>
      </div>
      <footer className="sg-foot sg-enter" style={enter(5)}>
        <p><em>United by service</em> to the Thomasian community.</p>
        <Link href="/constitution" className="lp-button is-ghost is-small">Read the Constitution <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </footer>
    </section>
  );
}

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { NightSky } from "@/components/night-sky";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { PrivacyStatement, PRIVACY_UPDATED, privacySections } from "@/components/privacy-statement";
import "../cookies/cookies.css";

export const metadata: Metadata = {
  title: "Privacy statement",
  description: "How UST Central Comelec handles personal information on its website and Commission Portal, and how to exercise your privacy rights.",
};

const enter = (order: number) => ({ "--enter": order }) as CSSProperties;
const updated = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" }).format(new Date(`${PRIVACY_UPDATED}T00:00:00+08:00`));

export default function PrivacyPage() {
  return <main className="ck">
    <RevealOnScroll />
    <header className="ck-hero" data-hero>
      <NightSky seed={2026} count={96} />
      <div className="ck-wrap ck-hero-inner"><div>
        <p className="ck-eyebrow" data-enter style={enter(0)}>Privacy statement · Website and portal</p>
        <h1 className="ck-title" data-enter style={enter(1)}>Your information.<br /><em>Your rights.</em></h1>
        <p className="ck-lede" data-enter style={enter(2)}>What we collect, why we need it, who can access it, and how to ask about your information.</p>
        <p className="ck-meta" data-enter style={enter(3)}><span>Updated <time dateTime={PRIVACY_UPDATED}>{updated}</time></span><span>UST Central Commission on Elections</span></p>
      </div></div>
    </header>
    <div className="ck-wrap ck-layout">
      <nav className="ck-toc" aria-label="On this page"><p className="ck-eyebrow">On this page</p><ol>{privacySections.map((section, index) => <li key={section.id}><a href={`#${section.id}`}><span>{String(index + 1).padStart(2, "0")}</span>{section.label}</a></li>)}</ol></nav>
      <PrivacyStatement />
    </div>
  </main>;
}

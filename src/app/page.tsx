import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { principles } from "@/lib/content";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="eyebrow">Welcome, Thomasian</div>
          <h1>Your voice<br /><em>moves UST.</em></h1>
          <p className="hero-copy">Your central hub for student elections, announcements, and the information you need to participate with confidence.</p>
          <div className="hero-actions">
            <Link href="/archive" className="button-primary">View election information <ArrowUpRight size={15} /></Link>
            <Link href="/about" className="text-link">About the commission</Link>
          </div>
          <span className="hero-note">2026 · 93rd Central Elections</span>
        </div>
      </section>

      <div className="ticker"><div className="ticker-inner"><span>2026 Central Elections</span><span>Registration is open</span><span>Know your vote</span></div></div>

      <section className="section resource-section">
        <div className="section-head"><div><div className="eyebrow">UST Central Comelec</div><h2>Everything you<br />need, in one place.</h2></div><p className="section-intro">Access official election resources, stay up to date, and make your student voice count.</p></div>
        <div className="resource-grid">
          <Link href="/news" className="resource-card resource-card-main"><span className="resource-icon">✦</span><span className="resource-kicker">Stay informed</span><strong>News & announcements</strong><p>Official updates from the commission.</p><span className="resource-arrow">↗</span></Link>
          <Link href="/archive" className="resource-card"><span className="resource-icon">◫</span><span className="resource-kicker">Plan ahead</span><strong>Election calendar</strong><p>Important dates and official results.</p><span className="resource-arrow">↗</span></Link>
          <Link href="/about" className="resource-card"><span className="resource-icon">◎</span><span className="resource-kicker">Know the office</span><strong>About the commission</strong><p>Our mandate, people, and principles.</p><span className="resource-arrow">↗</span></Link>
        </div>
      </section>

      <section className="feature-band"><div className="feature-band-inner"><div><div className="eyebrow">Your next step</div><h2>Make your vote<br /><em>count.</em></h2></div><div><p>Democracy works when students take part. Check the latest announcements before election day and come prepared to choose.</p><Link className="button-light" href="/news">Go to latest updates <ArrowUpRight size={15} /></Link></div></div></section>

      <section className="manifesto"><div className="section manifesto-grid"><div><div className="eyebrow">Why we do this</div><h2>Democracy is a practice, not a promise.</h2><p className="manifesto-copy">We create the space for students to choose, question, and participate. Our work is in the details: a clear ballot, a fair count, a process that earns trust.</p></div><div className="principle-list">{principles.map(([number, title, copy]) => <div className="principle" key={number}><span>{number}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div></div></section>
    </main>
  );
}

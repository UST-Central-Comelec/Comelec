import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Image className="footer-logo" src="/images/Logo-1.png" alt="UST Central Comelec logo" width={54} height={54} />
          <p className="footer-title">For every student.<br />For a better UST.</p>
          <p className="footer-description">The official student election commission of the University of Santo Tomas.</p>
          <a className="footer-email" href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph ↗</a>
        </div>
        <div className="footer-links">
          <div><span>The Commission</span><Link href="/about">Central Comelec</Link><Link href="/about">Local Comelec</Link><Link href="/about">En Banc</Link><Link href="/about">Contact</Link></div>
          <div><span>Voter Info</span><Link href="/about">Constitution</Link><Link href="/about">Elections Code</Link><Link href="/about">File a petition</Link><Link href="/about">Proclamation</Link></div>
          <div><span>Information</span><Link href="/news">News & updates</Link><Link href="/archive">Executive Orders</Link><Link href="/archive">Memorandums</Link><Link href="/archive">Resolutions</Link></div>
        </div>
      </div>
      <div className="footer-newsletter"><div><span>Stay informed</span><strong>Important updates, without the noise.</strong></div><Link href="/news">Visit the newsroom ↗</Link></div>
      <div className="footer-bottom"><span>© 2026 UST CENTRAL COMMISSION ON ELECTIONS</span><span>Privacy · Terms · Accessibility</span><span>University of Santo Tomas · Manila</span></div>
    </footer>
  );
}
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
          <address className="footer-address">Room 4F, 4th floor, UST Tan Yan Kee Student Center, University of Santo Tomas, España Boulevard, Sampaloc, Manila, Philippines</address>
          <a className="footer-email" href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph ↗</a>
        </div>
        <div className="footer-links">
          <div><span>The Commission</span><Link href="/about#central-comelec">Central Comelec</Link><Link href="/about#local-comelec">Local Comelec</Link><Link href="/about#en-banc">En Banc</Link><Link href="/about#chamber-of-chairpersons">Chamber of Chairpersons</Link><Link href="/apply">Become a Commissioner</Link><Link href="/candidacy">Filing of Candidacy</Link><Link href="/party-registration">Party Registration</Link><Link href="/about#contact">Contact</Link></div>
          <div><span>Voter Info</span><Link href="/archive?type=constitution">Constitution</Link><Link href="/archive?type=elections-code">Elections Code</Link><Link href="/about#contact">File a petition</Link><Link href="/archive?type=proclamation">Proclamation</Link></div>
          <div><span>Information</span><Link href="/news">News & updates</Link><Link href="/archive?type=executive-order">Executive Orders</Link><Link href="/archive?type=memorandum">Memorandums</Link><Link href="/archive?type=resolution">Resolutions</Link></div>
        </div>
      </div>
      <div className="footer-newsletter"><div><span>Stay informed</span><strong>Important updates, without the noise.</strong></div><Link href="/news">Visit the newsroom ↗</Link></div>
      <div className="footer-bottom"><span>© 2026 UST CENTRAL COMMISSION ON ELECTIONS</span><span>Privacy · Terms · Accessibility</span><span>University of Santo Tomas · Manila</span></div>
    </footer>
  );
}
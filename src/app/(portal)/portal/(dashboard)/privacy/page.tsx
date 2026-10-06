import type { Metadata } from "next";
import { PrivacyStatement, PRIVACY_UPDATED, privacySections } from "@/components/privacy-statement";
import { requirePortalUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Privacy statement" };

export default async function PortalPrivacyPage() {
  await requirePortalUser();
  return <main className="portal-page">
    <header className="portal-page-head"><div><p className="portal-eyebrow">Website and portal</p><h1>Privacy statement</h1><p className="portal-muted">How your information is handled and how to exercise your rights.</p><p className="portal-muted">Updated <time dateTime={PRIVACY_UPDATED}>October 6, 2026</time></p></div></header>
    <nav className="portal-privacy-contents" aria-label="On this page">{privacySections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.label}</a>)}</nav>
    <PrivacyStatement portal />
  </main>;
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireAccess } from "@/lib/auth/session";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { OnboardingProfilePreview } from "@/components/portal/onboarding-profile-preview";

export const metadata: Metadata = { title: "Onboarding profile" };

export default async function OnboardingProfilePage() {
  await requireAccess("legals/onboarding");
  return <main className="portal-page">
    <header className="portal-page-head">
      <div>
        <Link className="portal-back" href="/portal/legals/onboarding">← Onboarding</Link>
        <p className="portal-eyebrow">Legals · Documents · Step 1</p>
        <TitleWithInfo info="The built-in profile step collects the requester’s details after they verify their UST Google account. You can view its fields here. They are locked, and this step always stays at step 1.">Profile</TitleWithInfo>
        <p className="portal-muted">Version Alpha · Original draft</p>
      </div>
      <ViewOnlyTag />
    </header>
    <OnboardingProfilePreview />
  </main>;
}

import type { Metadata } from "next";
import { ComingSoon } from "@/components/portal/coming-soon";
import { requireCentral } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Email Sender" };

export default async function PortalEmailSenderPage() {
  await requireCentral();
  return <ComingSoon section="Apps" title="Email Sender">The email sender isn’t built yet.</ComingSoon>;
}

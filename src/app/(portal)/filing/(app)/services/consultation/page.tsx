import type { Metadata } from "next";
import { RequestPage } from "../request-page";

export const metadata: Metadata = { title: "Book a consultation" };

export default function FilingConsultationPage() {
  return <RequestPage kind="consultation" />;
}

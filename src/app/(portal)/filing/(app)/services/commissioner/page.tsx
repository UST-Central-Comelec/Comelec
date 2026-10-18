import type { Metadata } from "next";
import { RequestPage } from "../request-page";

export const metadata: Metadata = { title: "Request a commissioner" };

export default function FilingCommissionerPage() {
  return <RequestPage kind="commissioner" />;
}

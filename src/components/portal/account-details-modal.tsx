"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ApplicationModal } from "./application-modal";

export function AccountDetailsModal({ children, returnHref }: { children: ReactNode; returnHref?: string }) {
  const router = useRouter();
  return <ApplicationModal titleId="account-review-title" closeLabel="Close account details" onClose={() => returnHref ? router.replace(returnHref, { scroll: false }) : router.back()}>
    <article className="portal-registrant-receipt portal-account-review">
      <div className="portal-registrant-receipt-body">{children}</div>
    </article>
  </ApplicationModal>;
}

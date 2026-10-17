import type { OfferState } from "./offer";

export const applicationStatuses = {
  pending: "Pending review",
  reviewing: "Under review",
  accepted: "Accepted",
  declined: "Rejected",
} as const;

export type ApplicationStatus = keyof typeof applicationStatuses;

/** portal-tag colour per status. */
export const statusTag: Record<ApplicationStatus, string> = { pending: "is-gold", reviewing: "is-gold", accepted: "is-ok", declined: "is-warn" };

export const isApplicationStatus = (value: unknown): value is ApplicationStatus => typeof value === "string" && value in applicationStatuses;


/** The status the portal shows, with how an accepted applicant answered their offer (./offer.ts). */
export function shownStatus(status: ApplicationStatus, offer: OfferState): { label: string; tone: string } {
  if (offer === "declined") return { label: "Offer declined", tone: "is-warn" };
  if (offer === "lapsed") return { label: "Offer lapsed", tone: "is-warn" };
  if (offer === "joined") return { label: "Joined", tone: "is-ok" };
  return { label: applicationStatuses[status], tone: statusTag[status] };
}

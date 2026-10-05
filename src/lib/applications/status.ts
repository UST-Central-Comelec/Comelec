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


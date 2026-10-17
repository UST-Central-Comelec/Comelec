// Shared by the verification popup's last page (./callback.ts) and the sign-up forms.

export const FILING_CHANNEL = "filing-verification";

/** "has-account": this UST account has already filed this application, so it's signed in instead. */
export type FilingVerifyStatus = "ok" | "has-account" | "not-ust" | "failed" | "rate-limited" | "unavailable";
export type FilingVerifiedProfile = { email: string; firstName: string; lastName: string };
export type FilingVerifyMessage = { status: FilingVerifyStatus; profile: FilingVerifiedProfile | null };

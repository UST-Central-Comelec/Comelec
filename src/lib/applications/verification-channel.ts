import type { CommissionAccounts } from "./account-eligibility";

// Shared by the verification popup's last page (verification-page.ts) and the application form.

export const VERIFICATION_CHANNEL = "apply-verification";

export type VerificationStatus = "ok" | "not-ust" | "failed" | "rate-limited" | "unavailable";
export type VerifiedProfile = { email: string; firstName: string; lastName: string; commissionAccounts?: CommissionAccounts };
export type VerificationMessage = { status: VerificationStatus; profile: VerifiedProfile | null };

// Shared by the Request access form and the last page of its Google verification popup
// (finish-page.ts), which reports back over this BroadcastChannel.

export const ACCESS_CHANNEL = "portal-access-verification";

/** `verify` proves the account before the form is filled in; `confirm` proves it again on submit. */
export type AccessStep = "verify" | "confirm";

export type AccessStatus = "verified" | "confirmed" | "not-ust" | "has-access" | "revoked" | "mismatch" | "expired" | "failed" | "rate-limited" | "unavailable";

export type AccessProfile = { email: string; firstName: string; lastName: string };

export type AccessMessage = { status: AccessStatus; profile: AccessProfile | null };

/** Why a verification didn't go through, in words. */
export const accessStatusMessages: Partial<Record<AccessStatus, string>> = {
  "not-ust": "That wasn’t a UST account. Use your @ust.edu.ph Google account.",
  "has-access": "That account already has portal access. Go back and sign in with Google.",
  revoked: "That account’s portal access was revoked. Contact a Central Comelec executive if you think this is a mistake.",
  mismatch: "That was a different Google account. Confirm with the same UST account you verified.",
  expired: "Your verification expired. Verify your UST account again.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Requesting access isn’t available right now. Please email comelec@ust.edu.ph.",
};

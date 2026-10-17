// An acceptance is an offer: the acceptance email asks the applicant to Join the Commission or
// Decline. It stays open OFFER_DAYS from the day that email is sent; an offer nobody answers lapses
// then, which counts as declining. Declining, or letting it lapse, frees the slot and keeps them
// from applying to that unit again for REAPPLY_DAYS, unless the unit accepts them again.
// supabase/migrations/0088_acceptance_offers.sql does the lapsing; keep the numbers the same.
//
// Free of server-only imports: the tracker and the portal's applicant view read the same rules.

export const OFFER_DAYS = 14;
export const REAPPLY_DAYS = 60;

const DAY = 86_400_000;

export type OfferResponse = "joined" | "declined" | "lapsed";
/** Where an accepted application's offer stands. "none": it isn't accepted, and was never declined. */
export type OfferState = "open" | OfferResponse | "none";

export const offerExpiry = (sentAt = Date.now()) => new Date(sentAt + OFFER_DAYS * DAY).toISOString();
export const reapplyFrom = (respondedAt: string | number = Date.now()) => new Date(new Date(respondedAt).getTime() + REAPPLY_DAYS * DAY).toISOString();

export const isOfferResponse = (value: unknown): value is OfferResponse => value === "joined" || value === "declined" || value === "lapsed";

/**
 * An offer past its 14 days counts as lapsed straight away, even before the hourly job closes it.
 * An acceptance sent before offers had a deadline has none.
 */
export function offerStateOf(status: string, response: OfferResponse | null, expiresAt: string | null, now = Date.now()): OfferState {
  if (response) return response;
  if (status !== "accepted") return "none";
  return expiresAt && new Date(expiresAt).getTime() <= now ? "lapsed" : "open";
}

export const formatOfferDate = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" }).format(new Date(iso));

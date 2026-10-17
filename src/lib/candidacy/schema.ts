import { z } from "zod";
import { containsEmoji, titleCaseText } from "@/lib/forms/input";
import { firstErrors, today, type SignUpValues } from "@/lib/filing-portal/schema";

// Filing of Candidacy's candidacy step: the unit, the office, the party it runs under (or none),
// and what the certificate states (Elections Code, Section 6.2). Who the candidate is comes from the
// filing portal's own sign-up (src/lib/filing-portal/schema.ts).

/** At least this old on the day they file: a sanity check on the date, not an eligibility rule. */
const youngest = () => { const date = new Date(); date.setFullYear(date.getFullYear() - 12); return date.toISOString().slice(0, 10); };

export const candidacyFields = z.object({
  unit: z.string().min(1, "Choose the Comelec unit you’re filing with."),
  position: z.string().trim().min(1, "Choose the position you’re running for."),
  runningFor: z.enum(["independent", "party"], "Choose whether you’re running under a party or as an independent."),
  dateOfBirth: z.iso.date("Pick your date of birth.").refine((value) => value < today() && value <= youngest(), "Check your date of birth."),
  residence: z.string().trim().min(1, "Enter your address for election matters.").max(250, "Use 250 characters or fewer.").refine((value) => !containsEmoji(value), "Emoji aren’t allowed here.").transform(titleCaseText),
  oath: z.literal(true, "Take the oath to file your certificate of candidacy."),
});

/**
 * What's wrong with Your candidacy, by field. The unit must be one taking filings (`openUnits`, by
 * key: "" for the Central Comelec), the position one of its own, and a party one that's accredited.
 */
export function candidacyErrors(values: SignUpValues, openUnits: readonly string[], positions: Record<string, readonly string[]>, parties: ReadonlyArray<{ id: string; college: string }>, { oath = true } = {}) {
  const parsed = candidacyFields.safeParse({ ...values, oath: oath ? values.oath : true });
  const errors = parsed.success ? {} : firstErrors(parsed.error);
  const unit = values.unit === "central" ? "" : values.unit;
  if (!errors.unit && !openUnits.includes(unit)) errors.unit = "That unit isn’t taking filings right now. Choose another.";
  if (!errors.position && !errors.unit && !(positions[unit] ?? []).includes(values.position)) errors.position = "Choose a position from the unit’s list.";
  if (values.runningFor === "party" && !parties.some((party) => party.id === values.candidacyParty && party.college === unit)) errors.candidacyParty = "Choose an accredited party registered with the same unit.";
  return errors;
}

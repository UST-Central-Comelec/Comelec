import { z } from "zod";
import { containsEmoji, titleCaseText } from "@/lib/forms/input";
import { firstErrors, today, type SignUpValues } from "@/lib/filing-portal/schema";

// Political Party Registration's party step: joining a party that's registering, or making one.
// Who the member is comes from the filing portal's own sign-up (src/lib/filing-portal/schema.ts).

const noEmoji = (value: string) => !containsEmoji(value);

/** A new party: its name, the unit it registers with, when it was founded and where it holds office. */
export const newPartyFields = z.object({
  partyName: z.string().trim().min(1, "Enter your party’s name.").max(120, "Use 120 characters or fewer.").refine(noEmoji, "Emoji aren’t allowed in the party’s name.").transform((value) => value.replace(/\s+/g, " ").toLocaleUpperCase("en-PH")),
  unit: z.string().min(1, "Choose the Comelec unit you’re registering with."),
  establishedAt: z.iso.date("Pick the date the party was established.").refine((value) => value <= today(), "The date of establishment can’t be in the future."),
  headquarters: z.string().trim().max(250, "Use 250 characters or fewer.").refine(noEmoji, "Emoji aren’t allowed here.").transform(titleCaseText),
});

/**
 * What's wrong with Your party, by field. Joining needs only the party; making one needs its
 * details, and the unit must be one that's open (`openUnits`, by key: "" for the Central Comelec).
 */
export function partyErrors(values: SignUpValues, openUnits: readonly string[]) {
  if (values.partyId) return {};
  const parsed = newPartyFields.safeParse(values);
  const errors = parsed.success ? {} : firstErrors(parsed.error);
  if (!errors.unit && !openUnits.includes(values.unit === "central" ? "" : values.unit)) errors.unit = "That unit isn’t taking registrations right now. Choose another.";
  if (values.unit === "central" && !values.headquarters) errors.headquarters ??= "Enter the party’s principal headquarters. Central Comelec parties need one.";
  return errors;
}

/** The same name, however it's typed: what makes two parties one. */
export const partyNameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-PH");

import "server-only";

import { after } from "next/server";
import { describeRole, properName, toSummary } from "@/lib/data/accounts";
import { store } from "@/lib/data/store";
import { describeAffiliation, type AccountAffiliation, type AccountKind, type AccountPosition } from "@/lib/data/types";
import { sendEmail, type Email } from "@/lib/email/send";
import { CENTRAL, isLocalConcern, unitRecipients, type Concern, type Recipient } from "./concern";
import { isEmailOn } from "./switch-store";
import type { EmailKey } from "./switches";
import { recordActivity } from "./inbox-store";

// Sending the emails the site sends by itself: whether each is switched on (Apps → Email Sender
// → Automatic, ./switches.ts), who a notice goes to (./concern.ts has the rule), and getting it out
// without holding up or failing what the person was doing.

/** How sending went: it went, it didn't, or that email is switched off (or had nobody to go to). */
export type Sent = "sent" | "failed" | "off";

/**
 * Sends one automatic email, if its switch is on. `build` is only run when it is. Never throws.
 * Every automatic email goes through here or through `emailUnit`, so a switch turned off under
 * Email Sender → Automatic stops it wherever it's sent from.
 */
export async function sendAutomatic(key: EmailKey, build: () => Email | Promise<Email>): Promise<Sent> {
  try {
    const email = await build();
    await recordActivity(email);
    if (!(await isEmailOn(key))) return "off";
    return (await sendEmail(email)) ? "sent" : "failed";
  } catch (error) {
    console.error(`Couldn’t send an email (${key}):`, error instanceof Error ? error.message : error);
    return "failed";
  }
}

/**
 * Who in the commission is told about `concern`, from the accounts as they stand now. A Central
 * matter always reaches the built-in executive's mailbox (PORTAL_EXECUTIVE_EMAIL, the Central
 * Comelec's own), listed under Accounts or not.
 */
export async function recipientsFor(concern: Concern): Promise<Recipient[]> {
  const recipients = unitRecipients(concern, (await store.list("accounts")).map(toSummary));
  const builtIn = process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase();
  if (!isLocalConcern(concern) && builtIn && !recipients.some((recipient) => recipient.email === builtIn)) recipients.unshift({ name: "Central Comelec", email: builtIn });
  return recipients;
}

const clean = (emails: readonly string[]) => emails.map((email) => email.trim().toLowerCase()).filter(Boolean);

/**
 * `also` are others who get it too (a revision's editors); `except` are those left out, because
 * they're sent an email of their own about the same thing. `always` sends it whatever its switch
 * says: the notice that a switch was turned off, the notices' own included.
 */
type Others = { also?: readonly string[]; except?: readonly string[]; always?: boolean };

/**
 * Sends one automatic email to a unit's official account and Executive Board, if its switch is on.
 * `build` is given the addresses. "off" also when there was nobody to send it to. Never throws.
 */
export async function emailUnit(key: EmailKey, concern: Concern, build: (to: string[]) => Email, { also = [], except = [], always = false }: Others = {}): Promise<Sent> {
  try {
    const unit = (await recipientsFor(concern)).map((recipient) => recipient.email);
    if (!unit.length) console.warn(`A ${concern.unit} matter${isLocalConcern(concern) ? ` (${concern.college})` : ""} has no unit to email: no official account or Executive Board under Accounts.`);
    const left = new Set(clean(except));
    const to = [...new Set(clean([...unit, ...also]))].filter((email) => !left.has(email));
    if (!to.length) return "off";
    const email = build(to);
    await recordActivity(email, concern);
    if (!always && !(await isEmailOn(key))) return "off";
    return (await sendEmail(email)) ? "sent" : "failed";
  } catch (error) {
    console.error(`Couldn’t send a notice (${key}):`, error instanceof Error ? error.message : error);
    return "failed";
  }
}

/** The same, to the Central Comelec: what concerns the whole commission (its settings, its texts). */
export const emailCentral = (key: EmailKey, build: (to: string[]) => Email, others?: Others) => emailUnit(key, CENTRAL, build, others);

/**
 * Runs `task` once the response has gone, so a slow or failing mail server never holds up what
 * the person was doing, and never fails it. Outside a request there's no response to wait for, so
 * it starts straight away.
 */
export function later(task: () => Promise<unknown>) {
  const run = () =>
    task().catch((error: unknown) => {
      console.error("Couldn’t send an email:", error instanceof Error ? error.message : error);
    });
  try {
    after(run);
  } catch {
    void run();
  }
}

/** How many emails of a batch are on their way at once. Gmail turns away a flood. */
const LANES = 2;

/** Sends a batch of one automatic email, a couple at a time: one each to many people, as when access ends for every commissioner at once. Nothing goes if its switch is off. */
export async function sendEach(key: EmailKey, emails: readonly Email[]) {
  const on = await isEmailOn(key);
  let next = 0;
  const lane = async () => {
    while (next < emails.length) {
      const email = emails[next++];
      await recordActivity(email);
      if (on) await sendEmail(email);
    }
  };
  await Promise.all(Array.from({ length: Math.min(LANES, emails.length) }, lane));
}

/** Whoever did something, as an email names them: "Juan Dela Cruz", "Chairperson, Central Comelec". */
export type Actor = { name: string; email: string; role: string };

type Acting = { name: string; email: string; kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition; role: string; college: string | null };

export const actorOf = (user: Acting): Actor => ({
  name: properName(user.name),
  email: user.email,
  role: user.kind === "official" ? `${describeAffiliation(user.affiliation, user.college)} official account` : `${describeRole(user)}, ${describeAffiliation(user.affiliation, user.college)}`,
});

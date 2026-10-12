import "server-only";

import { promises as dns } from "node:dns";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";

// Every email typed into a form must have a domain that takes mail: one with mail servers (MX
// records). A made-up or misspelt domain ("gmial.con") is refused. When DNS itself can't be reached,
// the address is let through rather than blocking everyone's form.

const LOOKUP_MS = 3000;
const KEEP_MS = 60 * 60_000;
const answers = new Map<string, { ok: boolean; at: number }>();

/** Answers only about the domain: no mail servers, or it doesn't exist. Null for a lookup that failed. */
async function takesMail(domain: string): Promise<boolean | null> {
  const lookup = dns.resolveMx(domain).then(
    // A "null MX" (RFC 7505) says the domain takes no mail.
    (records) => records.some((record) => record.exchange && record.exchange !== "."),
    (error: NodeJS.ErrnoException) => (error.code === "ENOTFOUND" || error.code === "ENODATA" ? false : null),
  );
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOOKUP_MS));
  return Promise.race([lookup, timeout]);
}

/** Why this email can't be used, or null. Expects an address already shaped like one (src/lib/forms/fields.ts). */
export async function emailDomainProblem(email: string): Promise<string | null> {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain) return "Enter a valid email address, like name@example.com.";
  if (domain === ALLOWED_EMAIL_DOMAIN) return null;
  const known = answers.get(domain);
  if (known && Date.now() - known.at < KEEP_MS) return known.ok ? null : problem(domain);

  const ok = await takesMail(domain);
  if (ok === null) {
    console.error(`Couldn’t check the email domain ${domain}; let through.`);
    return null;
  }
  if (answers.size > 1000) answers.clear();
  answers.set(domain, { ok, at: Date.now() });
  return ok ? null : problem(domain);
}

const problem = (domain: string) => `${domain} can’t receive email. Check the spelling of the address.`;

/** The first of several emails that can't be used, keyed as the form names them. */
export async function emailDomainProblems(emails: Record<string, string>): Promise<Record<string, string>> {
  const entries = Object.entries(emails).filter(([, value]) => value.trim());
  const found = await Promise.all(entries.map(async ([key, value]) => [key, await emailDomainProblem(value)] as const));
  return Object.fromEntries(found.filter((entry): entry is readonly [string, string] => entry[1] !== null));
}

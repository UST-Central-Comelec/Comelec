// The emails the site sends by itself, each with a switch: Apps → Email Sender → Automatic turns
// any of them off, and back on. What's below is every one of them and whether it's sent until
// someone says otherwise; only the changes from these defaults are saved (./switch-store.ts,
// public.email_settings).
//
// Two are off to begin with: the notices that tell a unit about every new application and every
// new access request. With hundreds of applicants, one email to a whole Executive Board per
// application would use up the mailbox's daily sending limit, and the receipts with it.
//
// Free of server-only imports: the page with the switches reads the same list the server sends by.

export const emailDefaults = {
  "access-received": true,
  "access-notice": false,
  "access-approved": true,
  "access-declined": true,
  "application-received": true,
  "application-notice": false,
  "application-accepted": true,
  "application-declined": true,
  "party-received": true,
  "party-result": true,
  "candidacy-received": true,
  "candidacy-result": true,
  "petition-received": true,
  "petition-notice": true,
  "revision-approval": true,
  "revision-submitted": true,
  "revision-signed": true,
  "revision-published": true,
  "revision-returned": true,
  "revision-withdrawn": true,
  "event-registered": true,
  "event-waitlisted": true,
  "event-changes": true,
  "event-request": true,
  "setting-recruitment": true,
  "setting-filings": true,
  "setting-site": true,
  "setting-access": true,
  "setting-email": true,
  "account-added": true,
  "account-updated": true,
  "account-revoked": true,
  "account-restored": true,
  "account-expired": true,
  "account-removed": true,
} as const satisfies Record<string, boolean>;

export type EmailKey = keyof typeof emailDefaults;

/** Registration receipts are mandatory, including when an older saved switch is off. */
export const isRequiredEmail = (key: EmailKey) => key === "event-registered" || key === "event-waitlisted";

export const emailKeys = Object.keys(emailDefaults) as EmailKey[];

export const isEmailKey = (value: unknown): value is EmailKey => typeof value === "string" && Object.hasOwn(emailDefaults, value);

/** Which emails are sent: every key, on or off. */
export type EmailSwitches = Record<EmailKey, boolean>;

/** A set of changes from the defaults: only the emails switched the other way. */
export type SwitchOverrides = Partial<Record<EmailKey, boolean>>;

/** The defaults with the saved changes over them. */
export const switchesWith = (overrides: SwitchOverrides = {}): EmailSwitches => ({ ...emailDefaults, ...overrides, "event-registered": true, "event-waitlisted": true });

/** The changes that turn the defaults into `on` (the emails switched on), to save. */
export function overridesFor(on: readonly EmailKey[]): SwitchOverrides {
  const changes: SwitchOverrides = {};
  for (const key of emailKeys) if (!isRequiredEmail(key) && on.includes(key) !== emailDefaults[key]) changes[key] = on.includes(key);
  return changes;
}

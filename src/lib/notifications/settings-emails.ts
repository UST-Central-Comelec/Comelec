import "server-only";

import { formatClosing, type ApplicationPeriod } from "@/lib/applications/period";
import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, escape, highlight, note, paragraph, shell, siteUrl, type Details } from "@/lib/email/template";
import { CENTRAL, describeRecipients, type Concern } from "./concern";
import { emailUnit, later, type Actor } from "./notify";
import type { EmailKey } from "./switches";

// The email a change to the commission's settings sends: applications opened or closed, a filing
// period changed, the website put under maintenance, a level's access changed, the date accounts
// expire moved, an automatic email switched off. Whoever changed it is named, with what it was before.
//
// The commission's settings are the Central Comelec's to hear about: its official account and its
// Executive Board (./concern.ts), and nobody Local. The one kind of setting a Local unit has of its
// own is whether its Recruitment, Political Party Registration and Filing of Candidacy are open
// (src/lib/periods/kinds.ts): a change to one of those goes to that unit instead, and to nobody else.

/** The switches these emails come under, by the kind of setting (Apps → Email Sender → Automatic). */
export type SettingKey = Extract<EmailKey, `setting-${string}`>;

export type SettingChange = {
  /** Which switch it's sent under. */
  key: SettingKey;
  /** The part of the portal it's set in: "Recruitment", "Maintenance". */
  section: string;
  /** What the subject starts with, where "{section} settings" wouldn't read right. */
  label?: string;
  /** What happened, as the subject and the email's panel say it: "Commissioner applications are closing". */
  headline: string;
  /** The email's title. Mark accent words with *asterisks*. */
  title: string;
  /** What it means, in a sentence or two. */
  summary: string;
  /** What changed: the setting as it is now and as it was. */
  rows: Details;
  by: Actor;
  /** The page in the portal where it's set. */
  path: string;
  /** Whose setting it is, and so who's told. The Central Comelec's unless given. */
  concern?: Concern;
};

export function settingChangedEmail(recipients: string[], change: SettingChange, at = new Date().toISOString()): Email {
  const url = `${siteUrl()}${change.path}`;
  const rows: Details = [...change.rows, ["Changed by", `${change.by.name}, ${change.by.role}`], ["When", formatClosing(at)]];
  const label = change.label ?? `${change.section} settings`;
  const told = change.concern && change.concern.unit === "local"
    ? `Sent to ${describeRecipients(change.concern)}, who are told whenever one of the unit’s own settings changes.`
    : "Sent to the Central Comelec’s official account and Executive Board, who are told whenever a setting of the commission’s changes.";

  return {
    to: recipients.join(", "),
    subject: `${label}: ${change.headline}`,
    text: ["Hi,", change.summary, detailsText(rows), `Where it’s set: ${url}`, told, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: `Settings · ${change.section}`,
      title: change.title,
      preheader: change.summary,
      blocks: [highlight(label, change.headline, "name"), paragraph("Hi,"), paragraph(escape(change.summary)), details(rows), button(`Open ${change.section}`, url), note(escape(told))],
    }),
    replyTo: { name: change.by.name, address: change.by.email },
  };
}

/** Tells the unit whose setting it is (the Central Comelec, unless the change names another) once the response has gone, if these are switched on. `always` sends it whatever the switch says. */
export function settingChanged(change: SettingChange, { always = false }: { always?: boolean } = {}) {
  later(() => emailUnit(change.key, change.concern ?? CENTRAL, (to) => settingChangedEmail(to, change), { always }));
}

type Period = Pick<ApplicationPeriod, "mode" | "closesAt" | "graceEndsAt" | "opensAt">;

/** Where a period stands, in words: "Open, with no closing date", "Open until October 29, 2026, 11:59 PM", "Closing at …", "Closed". */
export function describePeriod(period: Period, now = Date.now()) {
  if (period.mode === "open") return "Open, with no closing date";
  if (period.mode === "scheduled" && period.opensAt && Date.parse(period.opensAt) > now) return `Opens ${formatClosing(period.opensAt)}${period.closesAt ? `, closes ${formatClosing(period.closesAt)}` : ""}`;
  if (period.mode === "scheduled") return period.closesAt ? `${Date.parse(period.closesAt) > now ? "Open until" : "Closed since"} ${formatClosing(period.closesAt)}` : "Open";
  return period.graceEndsAt && Date.parse(period.graceEndsAt) > now ? `Closing at ${formatClosing(period.graceEndsAt)}` : "Closed";
}

/**
 * Opening, scheduling or closing something people apply or file through: commissioner applications,
 * party registration, the filing of candidacy. `what` names it as it reads inside a sentence
 * ("commissioner applications", "Political Party Registration"), and `cancelled` marks a close that
 * was called off. Null when nothing changed.
 */
export function periodChange({ key, what, section, path, before, after, by, concern, cancelled = false }: { key: SettingKey; what: string; section: string; path: string; before: Period; after: Period; by: Actor; concern?: Concern; cancelled?: boolean }): SettingChange | null {
  const was = describePeriod(before);
  const now = describePeriod(after);
  if (was === now) return null;
  const named = `${what[0].toUpperCase()}${what.slice(1)}`;
  const change = (headline: string, title: string, summary: string): SettingChange => ({ key, section, headline: `${named} ${headline}`, title, summary, rows: [["Setting", `${named}: open or closed`], ["Now", now], ["Before", was]], by, path, concern });

  if (cancelled) return change("closing cancelled", "Closing *cancelled*", `${by.name} cancelled the closing of ${what}. Submissions stay open.`);
  if (after.mode === "closed") {
    return after.graceEndsAt && now.startsWith("Closing")
      ? change("closing", "Closing in a few *minutes*", `${by.name} closed ${what}. Submissions are still taken until ${formatClosing(after.graceEndsAt)}, so anyone partway through the form can finish, and the close can be cancelled until then.`)
      : change("closed", "Now *closed*", `${by.name} closed ${what}. Nothing more can be submitted until it’s opened again.`);
  }
  const until = after.mode === "scheduled" && after.closesAt
    ? `${after.opensAt && Date.parse(after.opensAt) > Date.now() ? `from ${formatClosing(after.opensAt)} ` : ""}until ${formatClosing(after.closesAt)}, when it closes by itself`
    : "with no closing date";
  if (now.startsWith("Opens")) return change("scheduled", "Now *scheduled*", `${by.name} scheduled ${what}: submissions are open ${until}.`);
  return before.mode === "closed" || was.startsWith("Closed") || was.startsWith("Opens")
    ? change("opened", "Now *open*", `${by.name} opened ${what}: submissions are open ${until}.`)
    : change("dates changed", "Dates *changed*", `${by.name} changed the dates of ${what}: submissions are open ${until}.`);
}

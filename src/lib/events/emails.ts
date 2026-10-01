import "server-only";

import { card, escape, greetingName, highlight, paragraph, siteUrl } from "@/lib/applications/emails";
import type { Email } from "@/lib/email/send";
import { formatEventDate, formatTime, scheduleRows } from "./format";
import { comelecUnit, describeAudience, venueModes, type CommissionEvent, type RegistrationKind } from "./options";

// The emails events send: a confirmation with the event's details when someone registers or joins
// the waitlist, and a note to a Local unit when the Central Comelec asks it to change an event.

type Details = Array<[label: string, value: string]>;

/** What, when and where, as the rows of the confirmation's table. */
function eventDetails(event: CommissionEvent): Details {
  return [
    ["Date", formatEventDate(event.eventDate)],
    ...scheduleRows(event),
    ["Venue", `${venueModes[event.venueMode]} · ${event.venueDetails}`],
    ["Open to", describeAudience(event)],
    ["Organizer", comelecUnit(event.organizer, event.college)],
  ];
}

const detailsTable = (rows: Details) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;width:100%">${rows
    .map(([label, value]) => `<tr><td style="border-top:1px solid #e5e2da;color:#6b6b75;font-size:13px;line-height:1.5;padding:10px 16px 10px 0;vertical-align:top;white-space:nowrap">${escape(label)}</td><td style="border-top:1px solid #e5e2da;color:#1d1c1b;font-size:14px;line-height:1.5;padding:10px 0;vertical-align:top">${escape(value)}</td></tr>`)
    .join("")}</table>`;

const detailsText = (rows: Details) => rows.map(([label, value]) => `${label}: ${value}`).join("\n");

const eventName = "font-size:20px;font-weight:700;line-height:1.3;margin-top:4px";

/** When to turn up, in a sentence. */
function arrivalNote(event: CommissionEvent) {
  const start = formatTime(event.startsTime);
  if (event.venueMode === "online") return `Please join a few minutes before ${start}.`;
  return event.ingressTime ? `Ingress starts at ${formatTime(event.ingressTime)}. Please be in before the activity begins at ${start}.` : `Please arrive a little before ${start}.`;
}

type Registrant = { email: string; firstName: string };

/** Sent when a registration is saved: a place confirmed, or a place on the waitlist. */
export function registrationEmail(registrant: Registrant, event: CommissionEvent, kind: RegistrationKind): Email {
  const pageUrl = `${siteUrl()}/events/${event.id}`;
  const unit = comelecUnit(event.organizer, event.college);
  const details = eventDetails(event);
  const greeting = `Hi ${greetingName(registrant.firstName)},`;
  const registered = kind === "registered";

  const intro = registered
    ? `You’re registered for ${event.name}, organized by the ${unit}. Here are the details:`
    : `Registration for ${event.name}, organized by the ${unit}, hasn’t opened yet, and you’re on its waitlist. Here’s what’s planned:`;
  const next = registered ? arrivalNote(event) : `Once registration opens, register on the event’s page to confirm your place. The details you gave will already be filled in.`;
  const help = `Plans can change, so check the event’s page for its latest status. Need to correct your details, or can’t make it? Email comelec@ust.edu.ph.`;

  return {
    to: registrant.email,
    subject: registered ? `You’re registered: ${event.name}` : `You’re on the waitlist: ${event.name}`,
    text: [greeting, intro, detailsText(details), next, `Event page: ${pageUrl}`, help, "UST Central Commission on Elections"].join("\n\n"),
    html: card([
      highlight(registered ? "You’re registered for" : "You’re on the waitlist for", event.name, eventName),
      paragraph(escape(greeting)),
      paragraph(escape(intro)),
      detailsTable(details),
      paragraph(escape(next)),
      paragraph(`<a href="${escape(pageUrl)}" style="color:#1d1c1b">Open the event’s page</a>`),
      paragraph(`Plans can change, so check the event’s page for its latest status. Need to correct your details, or can’t make it? Email <a href="mailto:comelec@ust.edu.ph" style="color:#1d1c1b">comelec@ust.edu.ph</a>.`),
    ]),
  };
}

/** Sent to a Local unit's commissioners when the Central Comelec asks for changes to one of its events. */
export function changeRequestEmail(recipients: string[], event: CommissionEvent, request: string, requestedBy: { name: string; email: string }): Email {
  const portalUrl = `${siteUrl()}/portal/events/${event.id}`;
  const intro = `The Central Comelec asked for changes to your unit’s event, ${event.name} (${formatEventDate(event.eventDate)}):`;
  const next = `Open the event in the Commission Portal to make the changes, then mark the request as addressed: ${portalUrl}`;
  const from = `Requested by ${requestedBy.name} (${requestedBy.email}).`;

  return {
    to: recipients.join(", "),
    subject: `Changes requested: ${event.name}`,
    text: ["Hi,", intro, request, next, from, "UST Central Commission on Elections"].join("\n\n"),
    html: card([
      highlight("Changes requested for", event.name, eventName),
      paragraph("Hi,"),
      paragraph(escape(intro)),
      `<blockquote style="border-left:3px solid #d4a017;color:#1d1c1b;font-size:15px;line-height:1.6;margin:0 0 16px;padding:2px 0 2px 16px;white-space:pre-line">${escape(request)}</blockquote>`,
      paragraph(`<a href="${escape(portalUrl)}" style="color:#1d1c1b">Open the event in the Commission Portal</a> to make the changes, then mark the request as addressed.`),
      paragraph(escape(from)),
    ]),
  };
}

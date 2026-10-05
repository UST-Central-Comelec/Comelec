import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, escape, greetingName, highlight, link, note, paragraph, quote, shell, siteUrl, type Details } from "@/lib/email/template";
import { formatEventDates, formatTime, scheduleRows } from "./format";
import { comelecUnit, describeAudience, requestKinds, venueModes, type CommissionEvent, type RegistrationKind, type RequestKind } from "./options";

// The emails events send: a confirmation with the event's details when someone registers or joins
// the waitlist, the unit's answer to something a registrant asked for under Logistics, and a note to a
// Local unit when the Central Comelec asks it to change an event.

/** What, when and where, as the rows of the confirmation's table. */
function eventDetails(event: CommissionEvent): Details {
  return [
    ["Date", formatEventDates(event)],
    ...scheduleRows(event),
    ["Venue", `${venueModes[event.venueMode]} · ${event.venueDetails}`],
    ["Open to", describeAudience(event)],
    ["Organizer", comelecUnit(event.organizer, event.college)],
  ];
}

/** When to turn up, in a sentence. */
function arrivalNote(event: CommissionEvent) {
  const start = formatTime(event.startsTime);
  if (event.venueMode === "online") return `Please join a few minutes before ${start}.`;
  return event.ingressTime ? `Ingress starts at ${formatTime(event.ingressTime)}. Please be in before the activity begins at ${start}.` : `Please arrive a little before ${start}.`;
}

type Registrant = { email: string; firstName: string; referenceCode: string };

/** Sent when a registration is saved: a place confirmed, or a place on the waitlist. */
export function registrationEmail(registrant: Registrant, event: CommissionEvent, kind: RegistrationKind): Email {
  const pageUrl = `${siteUrl()}/events/${event.id}`;
  const unit = comelecUnit(event.organizer, event.college);
  const rows: Details = [["Registration reference", registrant.referenceCode], ...eventDetails(event)];
  const trackUrl = `${siteUrl()}/apply/track?ref=${registrant.referenceCode}`;
  const tracking = "Track your registration and logistics requests using this reference code and your last name.";
  const greeting = `Hi ${greetingName(registrant.firstName)},`;
  const registered = kind === "registered";

  const intro = registered
    ? `You’re registered for ${event.name}, organized by the ${unit}. Here are the details:`
    : `Registration for ${event.name}, organized by the ${unit}, hasn’t opened yet, and you’re on its waitlist. Here’s what’s planned:`;
  const next = registered ? arrivalNote(event) : `Once registration opens, register on the event’s page with this same email to confirm your place.`;
  const help = `Plans can change, so check the event’s page for its latest status. Need to correct your details, or can’t make it? Email comelec@ust.edu.ph.`;

  return {
    to: registrant.email,
    subject: registered ? `You’re registered: ${event.name}` : `You’re on the waitlist: ${event.name}`,
    text: [greeting, intro, detailsText(rows), tracking, `Track registration: ${trackUrl}`, next, `Event page: ${pageUrl}`, help, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: "Events",
      title: registered ? "You’re *registered*" : "You’re on the *waitlist*",
      preheader: `${event.name}, ${formatEventDates(event)}.`,
      blocks: [
        highlight(registered ? "You’re registered for" : "You’re on the waitlist for", event.name, "name"),
        paragraph(escape(greeting)),
        paragraph(escape(intro)),
        details(rows),
        paragraph(escape(tracking)),
        button("Track registration", trackUrl),
        paragraph(escape(next)),
        button("Open the event’s page", pageUrl),
        note(`Plans can change, so check the event’s page for its latest status. Need to correct your details, or can’t make it? Email ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`),
      ],
    }),
  };
}

/** Sent to a Local unit's commissioners when the Central Comelec asks for changes to one of its events. */
export function changeRequestEmail(recipients: string[], event: CommissionEvent, request: string, requestedBy: { name: string; email: string }): Email {
  const portalUrl = `${siteUrl()}/portal/events/${event.id}`;
  const intro = `The Central Comelec asked for changes to your unit’s event, ${event.name} (${formatEventDates(event)}):`;
  const next = `Open the event in the Commission Portal to make the changes, then mark the request as addressed: ${portalUrl}`;
  const from = `Requested by ${requestedBy.name} (${requestedBy.email}).`;

  return {
    to: recipients.join(", "),
    subject: `Changes requested: ${event.name}`,
    text: ["Hi,", intro, request, next, from, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: "Events",
      title: "Changes *requested*",
      preheader: `The Central Comelec asked for changes to ${event.name}.`,
      blocks: [
        highlight("Changes requested for", event.name, "name"),
        paragraph("Hi,"),
        paragraph(escape(intro)),
        quote(request),
        paragraph("Open the event in the Commission Portal to make the changes, then mark the request as addressed."),
        button("Open the event", portalUrl),
        note(escape(from)),
      ],
    }),
  };
}

/** One thing a registrant asked for under Logistics, as the unit just answered it. */
export type AnsweredRequest = { kind: RequestKind; approved: boolean; revoked?: boolean; /** What they wrote for it: a car's plate, their allergens. */ detail: string };

/**
 * Sent when the organizing unit saves its answers to what a registrant asked for under Logistics:
 * every answer that changed in that save, each approved or not available, in one email. `waiting`
 * is how many of their requests are still unanswered, so it can say the rest will follow.
 */
export function requestDecisionsEmail(registrant: Pick<Registrant, "email" | "firstName">, event: CommissionEvent, answered: AnsweredRequest[], waiting = 0): Email {
  const pageUrl = `${siteUrl()}/events/${event.id}`;
  const unit = comelecUnit(event.organizer, event.college);
  const greeting = `Hi ${greetingName(registrant.firstName)},`;
  const approved = answered.filter((request) => request.approved);
  const declined = answered.filter((request) => !request.approved && !request.revoked);
  const revoked = answered.filter((request) => !request.approved && request.revoked);
  const one = answered.length === 1;
  const what = (request: AnsweredRequest) => requestKinds[request.kind].short;

  const intro = one
    ? approved.length
      ? `Your request for ${what(answered[0]).toLowerCase()} at ${event.name} has been approved by the ${unit}.`
      : revoked.length
        ? `The ${unit} has revoked the previous approval for your ${what(answered[0]).toLowerCase()} request at ${event.name}. This arrangement is no longer available.`
        : `We’re sorry: your request for ${what(answered[0]).toLowerCase()} at ${event.name} has been declined. The ${unit} couldn’t arrange it this time.`
    : `The ${unit} has saved updates to ${answered.length} of your logistics requests at ${event.name}: ${[approved.length ? `${approved.length} approved` : "", declined.length ? `${declined.length} declined` : "", revoked.length ? `${revoked.length} revoked` : ""].filter(Boolean).join(", ")}.`;
  const rows: Details = answered.map((request) => [what(request), `${request.approved ? "Approved" : request.revoked ? "Revoked" : "Declined"}${request.detail ? ` · ${request.detail}` : ""}`]);
  const eventRows: Details = [["Event", event.name], ["Date", formatEventDates(event)]];
  const after = [
    "This email includes every logistics decision changed in this update.",
    ...(revoked.length ? ["Previously approved arrangements marked Revoked are no longer available."] : []),
    ...(declined.length || revoked.length ? ["Your registration itself still stands."] : []),
    ...(waiting ? [`${waiting === 1 ? "One more request is" : `${waiting} more requests are`} still being looked at; you’ll be emailed once ${waiting === 1 ? "it’s" : "they’re"} answered.`] : []),
  ].join(" ");
  const subject = one ? `${approved.length ? "Approved" : revoked.length ? "Revoked" : "Declined"}: ${what(answered[0])} · ${event.name}` : `Your Logistics requests · ${event.name}`;
  const title = approved.length === answered.length ? (one ? "Request *approved*" : "Requests *approved*") : revoked.length === answered.length ? (one ? "Approval *revoked*" : "Approvals *revoked*") : declined.length === answered.length ? (one ? "Request *declined*" : "Requests *declined*") : "Logistics *update*";

  return {
    to: registrant.email,
    subject,
    text: [greeting, intro, detailsText(rows), ...(after ? [after] : []), detailsText(eventRows), `Event page: ${pageUrl}`, "Questions about it? Email comelec@ust.edu.ph.", COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: "Events",
      title,
      preheader: intro,
      blocks: [
        paragraph(escape(greeting)),
        paragraph(escape(intro)),
        details(rows),
        ...(after ? [paragraph(escape(after))] : []),
        details(eventRows),
        button("Open the event’s page", pageUrl),
        note(`Questions about it? Email ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`),
      ],
    }),
  };
}

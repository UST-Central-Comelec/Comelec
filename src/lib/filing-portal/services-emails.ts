import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, link, note, paragraph, quote, shell, siteUrl, status, type Details } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, type Concern } from "@/lib/notifications/concern";
import { unitName } from "@/lib/party-portal/types";
import { formatSlot, petitionStatusLabel, petitionTypes, requestKinds, requestModes, topicLabel, type FilingRequest, type Petition, type PetitionStatus } from "./services";

// The emails the filing portal's Services send by themselves (switches under Services → Email →
// Automatic): to the unit when a consultation or a commissioner is asked for ("service-notice"), to
// the filer when the unit answers ("service-answer"), and to the filer when a petition is docketed,
// resolved or dismissed ("petition-update"). A petition's receipt and the unit's notice of it are
// src/lib/petitions/emails.ts.

type Person = { firstName: string; email: string };

const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);
const greeting = (person: Person) => `Hi ${greetingName(person.firstName)},`;
const concernOfUnit = (college: string): Concern => (college ? { unit: "local", college } : { unit: "central" });

const requestRows = (request: FilingRequest): Details => [
  ["Request ID", request.reference],
  [request.kind === "consultation" ? "About" : "Activity", request.subject],
  [request.kind === "consultation" ? "Topic" : "Asked to", topicLabel(request)],
  ["Asked for", formatSlot(request.startsAt, request.endsAt)],
  ["How", requestModes[request.mode]],
  ...(request.venue ? [["Where", request.venue] as [string, string]] : []),
];

/** To the unit: a filer asked for a consultation, or for a commissioner at an activity. */
export function serviceNoticeEmail(recipients: string[], request: FilingRequest, filer: { name: string; email: string }): Email {
  const concern = concernOfUnit(request.college);
  const noun = requestKinds[request.kind].noun;
  const intro = isLocalConcern(concern)
    ? `A ${noun} for the ${unitName(request.college)} came in through the ${COMET}. Only your unit’s official account and Executive Board were told.`
    : `A ${noun} for the Central Comelec came in through the filing portal. Only the Central Comelec’s official account and Executive Board were told.`;
  const rows: Details = [...requestRows(request), ["From", `${filer.name} (${filer.email})`]];
  const url = `${siteUrl()}/portal/request/${request.id}`;
  const next = "Open Request in the Commission Portal to confirm it with a time and a place, or to decline it. Replying to this email writes to the filer.";
  return {
    to: recipients.join(", "),
    subject: `${through(`New ${noun}`, concern)}: ${request.subject} (${request.reference})`,
    text: ["Hi,", intro, detailsText(rows), request.details && `What they wrote:\n${request.details}`, `${next}\n${url}`, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor("Filing portal services", concern),
      title: request.kind === "consultation" ? "A consultation is *asked for*" : "A commissioner is *asked for*",
      preheader: `${request.subject}, ${formatSlot(request.startsAt, request.endsAt)}.`,
      blocks: [status("Waiting for you"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), ...(request.details ? [quote(request.details)] : []), paragraph(escape(next)), button("Open the request", url)],
    }),
    replyTo: { name: filer.name, address: filer.email },
  };
}

/** To the filer: the unit confirmed their request, declined it, or changed what it confirmed. */
export function serviceAnswerEmail(person: Person, request: FilingRequest): Email {
  const concern = concernOfUnit(request.college);
  const unit = unitName(request.college);
  const noun = requestKinds[request.kind].noun;
  const confirmed = request.status === "confirmed";
  const intro = confirmed
    ? request.kind === "consultation" ? `The ${unit} confirmed your consultation. Here’s when and where.` : `The ${unit} will send a commissioner to ${request.subject}. Here’s who and when.`
    : `The ${unit} couldn’t take your ${noun}. You can ask again for another time from the filing portal.`;
  const rows: Details = confirmed
    ? [["Request ID", request.reference], ["When", formatSlot(request.confirmedStart ?? request.startsAt, request.confirmedEnd ?? request.endsAt)], ["Where", request.location], [request.kind === "consultation" ? "With" : "Commissioner", request.assigned]]
    : [["Request ID", request.reference], [request.kind === "consultation" ? "About" : "Activity", request.subject]];
  const said = request.response.trim();
  const url = `${siteUrl()}${requestKinds[request.kind].href}`;
  const relay = relayNote(concern, `your ${noun}`);
  return {
    to: person.email,
    subject: confirmed ? `Confirmed: your ${noun} (${request.reference})` : `About your ${noun} (${request.reference})`,
    text: [greeting(person), intro, detailsText(rows), said && `The unit wrote:\n${said}`, `Open the filing portal: ${url}`, helpText, relay, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor("Filing portal", concern),
      title: confirmed ? `Your ${noun} is *confirmed*` : `About your *${noun}*`,
      preheader: intro,
      blocks: [...(confirmed ? [status("Confirmed", "ok")] : []), paragraph(escape(greeting(person))), paragraph(escape(intro)), details(rows), ...(said ? [quote(said)] : []), button("Open the filing portal", url), divider(), help, ...(relay ? [note(escape(relay))] : [])],
    }),
  };
}

/** To whoever filed a petition: it was docketed, resolved, dismissed or reopened. */
export function petitionUpdateEmail(person: Person, petition: Petition, status_: Exclude<PetitionStatus, "filed" | "withdrawn">): Email {
  const concern = concernOfUnit(petition.college);
  const unit = unitName(petition.college);
  const kind = petitionTypes[petition.type].label.toLowerCase();
  const intro = status_ === "docketed"
    ? `The ${unit} docketed your ${kind}. Whoever it’s against is asked to answer in writing within five school days, and the unit decides within five school days of that answer (Elections Code, Article XII, Sections 5 and 6).`
    : status_ === "resolved" ? `The ${unit} resolved your ${kind}. Its resolution is below.` : `The ${unit} dismissed your ${kind}. Its reasons are below.`;
  const rows: Details = [["Petition ID", petition.reference], ["Type", petitionTypes[petition.type].label], ["About", petition.subject], ["Where it stands", petitionStatusLabel[status_]]];
  const said = petition.remarks.trim();
  const url = `${siteUrl()}/filing/services/petition`;
  const relay = relayNote(concern, "this petition");
  return {
    to: person.email,
    subject: `${petitionStatusLabel[status_].split(",")[0]}: ${petition.subject} (${petition.reference})`,
    text: [greeting(person), intro, detailsText(rows), said && `The unit wrote:\n${said}`, `Open the filing portal: ${url}`, helpText, relay, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor("Petitions and Cases", concern),
      title: status_ === "docketed" ? "Your petition is *docketed*" : status_ === "resolved" ? "Your petition is *resolved*" : "Your petition is *dismissed*",
      preheader: intro,
      blocks: [...(status_ === "resolved" ? [status("Resolved", "ok")] : status_ === "docketed" ? [status("Docketed")] : []), paragraph(escape(greeting(person))), paragraph(escape(intro)), details(rows), ...(said ? [quote(said)] : []), button("Open the filing portal", url), divider(), help, ...(relay ? [note(escape(relay))] : [])],
    }),
  };
}

/* Samples, for Services → Email → Automatic */

const at = "2026-10-21T02:00:00.000Z";
const sampleRequest = (college: string | null, kind: FilingRequest["kind"] = "consultation"): FilingRequest => ({
  id: "00000000-0000-4000-8000-000000000000", reference: kind === "consultation" ? "BC-4T8W-2HNC" : "RC-6R2P-8YDM", accountId: "", kind, college: college ?? "",
  onBehalf: kind === "consultation" ? "self" : "party", partyId: null, partyName: kind === "consultation" ? null : "Lakas Tomasino Coalition",
  topic: kind === "consultation" ? "candidacy" : "observe", subject: kind === "consultation" ? "Which documents a transferee files" : "Lakas Tomasino general assembly",
  details: kind === "consultation" ? "I transferred last year. Do I file my old school’s transcript too, or only UST’s?" : "We elect our officers for the year, and want a commissioner to observe.",
  mode: "in-person", venue: kind === "consultation" ? "" : "Tan Yan Kee Student Center, Room 304", startsAt: at, endsAt: "2026-10-21T02:30:00.000Z",
  status: "confirmed", confirmedStart: at, confirmedEnd: "2026-10-21T02:30:00.000Z", location: "Comelec office, Tan Yan Kee Student Center", assigned: "Maria Santos, Legal Officer",
  response: "Bring your transcript from both schools, if you have them.", handledBy: null, handledAt: at, cancelledAt: null, createdAt: at, updatedAt: at,
});
const samplePetition = (college: string | null): Petition => ({
  id: "00000000-0000-4000-8000-000000000000", reference: "PC-9N4X-7BGE", accountId: "", college: college ?? "", type: "offense",
  subject: "Posters put up outside the designated areas", respondent: "Lakas Tomasino Coalition", occurredOn: "2026-10-19",
  statement: "", relief: "", files: [], status: "docketed", remarks: "The party is asked to answer in writing by October 28.", docketedBy: null, docketedAt: at, decidedBy: null, decidedAt: null, withdrawnAt: null, createdAt: at, updatedAt: at,
});

export const serviceNoticeSample = (college: string | null) => serviceNoticeEmail(["comelec@ust.edu.ph"], { ...sampleRequest(college), status: "requested" }, { name: "JUAN PAOLO R. DELA CRUZ", email: "juan.delacruz.sci@ust.edu.ph" });
export const serviceAnswerSample = (college: string | null) => serviceAnswerEmail({ firstName: "JUAN PAOLO", email: "juan.delacruz.sci@ust.edu.ph" }, sampleRequest(college));
export const petitionUpdateSample = (college: string | null) => petitionUpdateEmail({ firstName: "JUAN PAOLO", email: "juan.delacruz.sci@ust.edu.ph" }, samplePetition(college), "docketed");

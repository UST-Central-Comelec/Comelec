import "server-only";

import { formatClosing } from "@/lib/applications/period";
import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, highlight, link, note, paragraph, quote, shell, siteUrl, status, type Details } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { receiptBlocks, receiptText, type ReceiptSection } from "@/lib/notifications/receipt";

// The emails a petition or a case sends when it's submitted: a receipt to whoever submitted it,
// and a notice to the unit it concerns (its official account and its Executive Board).
//
// The Petitions & Cases form isn't built yet, so nothing sends these today. They're ready for it:
// on submit, call `petitionSubmitted` (./notify.ts), which sends both to the right people.
//
// A submission concerns the Central Comelec or a Local unit: the form asks which, and the college
// if Local. Either way it leaves from the Central Comelec's mailbox, so one for a Local unit says
// it came through the Central Comelec's COMET (src/lib/notifications/concern.ts).

export type Petition = {
  referenceCode: string;
  /** What the form calls it: "Petition", "Election protest", "Complaint". */
  type: string;
  /** What it's about, in a line. */
  subject: string;
  concern: Concern;
  /** Who submitted it, and where their emails go. */
  submitter: { name: string; firstName: string; email: string };
  submittedAt: string;
  /** What they wrote, for the unit's notice. Optional: the portal has the whole submission. */
  statement?: string;
};

const TOPIC = "Petitions & Cases";

const trackUrlOf = (petition: Petition) => `${siteUrl()}/apply/track?ref=${petition.referenceCode}`;
const portalUrl = () => `${siteUrl()}/portal/petitions/submissions`;

const summaryOf = (petition: Petition): Details => [["Type", petition.type], ["About", petition.subject], ["Submitted", formatClosing(petition.submittedAt)], ["Addressed to", unitOf(petition.concern)]];

/** To whoever submitted it: the receipt. `answers` is the form's own receipt, grouped as the form groups it. */
export function petitionReceivedEmail(petition: Petition, answers: ReceiptSection[] = []): Email {
  const { concern } = petition;
  const local = isLocalConcern(concern);
  const trackUrl = trackUrlOf(petition);
  const relay = relayNote(concern, "your submission");
  const greeting = `Hi ${greetingName(petition.submitter.firstName)},`;
  const kind = petition.type.toLowerCase();
  const intro = local ? `Your ${kind} to the ${unitOf(concern)} was received through the ${COMET}, and the unit has been notified.` : `We’ve received your ${kind}, and the commission has been notified.`;
  const next = `${local ? "The unit" : "The commission"} will write to you at this address about what happens next. Keep your reference code: you’ll need it to follow up.`;
  const summary = summaryOf(petition);

  return {
    to: petition.submitter.email,
    subject: `${through(`${petition.type} received`, concern)} (${petition.referenceCode})`,
    text: [greeting, `${intro} This email is your receipt.`, `Reference code: ${petition.referenceCode}`, detailsText(summary), receiptText(answers), next, `Track it: ${trackUrl}`, "Questions? Reply to this email, or write to comelec@ust.edu.ph.", relay, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? "Received through *COMET*" : "We’ve received your *submission*",
      preheader: `Your reference code is ${petition.referenceCode}. Keep this email as your receipt.`,
      blocks: [
        status("Received"),
        paragraph(escape(greeting)),
        paragraph(`${escape(intro)} This email is your receipt.`),
        highlight("Reference code", petition.referenceCode),
        details(summary),
        ...receiptBlocks(answers),
        paragraph(escape(next)),
        button("Track it", trackUrl),
        divider(),
        note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`),
        ...(relay ? [note(escape(relay))] : []),
      ],
    }),
  };
}

/** To the unit it concerns, its official account and its Executive Board: something was submitted, and it's theirs to act on. */
export function petitionNoticeEmail(recipients: string[], petition: Petition): Email {
  const { concern } = petition;
  const local = isLocalConcern(concern);
  const url = portalUrl();
  const kind = petition.type.toLowerCase();
  const intro = local
    ? `A ${kind} addressed to the ${unitOf(concern)} was submitted through the ${COMET}. It’s your unit’s to act on, and only your unit’s official account and Executive Board were told.`
    : `A ${kind} addressed to the Central Comelec was submitted on the website. Only the Central Comelec’s official account and Executive Board were told.`;
  const rows: Details = [...summaryOf(petition), ["Submitted by", `${petition.submitter.name} (${petition.submitter.email})`], ["Reference code", petition.referenceCode]];
  const next = "Open Petitions & Cases in the Commission Portal to read the whole submission. Replying to this email writes to whoever submitted it.";
  const statement = petition.statement?.trim();

  return {
    to: recipients.join(", "),
    subject: `${through(`${petition.type} received`, concern)}: ${petition.subject} (${petition.referenceCode})`,
    text: ["Hi,", intro, detailsText(rows), statement && `What they wrote:\n${statement}`, `${next}\n${url}`, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? `${petition.type} received through *COMET*` : `A new *${kind}*`,
      preheader: `${petition.type}: ${petition.subject}.`,
      blocks: [highlight(`New ${kind}`, petition.subject, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), ...(statement ? [quote(statement)] : []), paragraph(escape(next)), button("Open Petitions & Cases", url)],
    }),
    replyTo: { name: petition.submitter.name, address: petition.submitter.email },
  };
}

import "server-only";

import { formatClosing } from "@/lib/applications/period";
import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, heading, highlight, link, list, note, paragraph, quote, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { receiptBlocks, receiptText, type ReceiptSection } from "@/lib/notifications/receipt";
import { filingKinds, type FilingKind } from "./kinds";

// The emails a Political Party Registration or a Filing of Candidacy sends to whoever filed it: a
// receipt when it's submitted, and the result when the commission decides it.
//
// Neither form is built yet (only whether each is open: src/lib/periods/store.ts), so nothing sends these
// today. They're ready for the forms: on submit, call `filingReceived(filing, answers)`; on a
// decision in the portal, `filingDecided(filing, approved, remarks)` (./notify.ts).
//
// A filing is the Central Comelec's or a Local unit's (`concern`): each form asks which, and the
// college if Local. Either way it leaves from the Central Comelec's mailbox, so one for a Local
// unit says it came through the Central Comelec's COMET (src/lib/notifications/concern.ts).

export type Filing = {
  kind: FilingKind;
  referenceCode: string;
  concern: Concern;
  /** Who filed it, and where their emails go. */
  filer: { firstName: string; email: string };
  /** What it's for, in a few words: the party's name, or the position sought. */
  subject: string;
  submittedAt: string;
};

/** How each filing is spoken of: "your registration", "your certificate of candidacy". */
const wording: Record<FilingKind, { yours: string; received: string; label: string; approved: string; approvedTitle: string }> = {
  "party-registration": { yours: "your registration", received: "Party registration received", label: "Party", approved: "Registered", approvedTitle: "Your party is *registered*" },
  candidacy: { yours: "your certificate of candidacy", received: "Certificate of candidacy received", label: "Running for", approved: "Accepted", approvedTitle: "Your candidacy is *accepted*" },
};

const trackUrlOf = (filing: Filing) => `${siteUrl()}/apply/track?ref=${filing.referenceCode}`;

const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);

function closing(filing: Filing) {
  const relay = relayNote(filing.concern, wording[filing.kind].yours);
  return { blocks: [divider(), help, ...(relay ? [note(escape(relay))] : [])], text: [helpText, relay].filter(Boolean).join("\n\n") };
}

/** The receipt: what was filed, and where to track it. `answers` is the form's own receipt, grouped as the form groups it. */
export function filingReceivedEmail(filing: Filing, answers: ReceiptSection[] = []): Email {
  const { concern, kind } = filing;
  const local = isLocalConcern(concern);
  const words = wording[kind];
  const trackUrl = trackUrlOf(filing);
  const end = closing(filing);
  const greeting = `Hi ${greetingName(filing.filer.firstName)},`;
  const intro = local
    ? `${words.yours[0].toUpperCase()}${words.yours.slice(1)} with the ${unitOf(concern)} was received through the ${COMET}, and it’s now pending the unit’s review.`
    : `We’ve received ${words.yours}, and it’s now pending the commission’s review.`;
  const summary: Details = [[words.label, filing.subject], ["Submitted", formatClosing(filing.submittedAt)], ["Filed with", unitOf(concern)]];
  const next = [`Check on it any time: open Track application and enter your reference code.`, `We’ll email you again once ${local ? "the unit" : "the commission"} has decided it.`];

  return {
    to: filing.filer.email,
    subject: `${through(words.received, concern)} (${filing.referenceCode})`,
    text: [greeting, `${intro} This email is your receipt.`, `Reference code: ${filing.referenceCode}`, detailsText(summary), receiptText(answers), "What happens next", next.map((line, index) => `${index + 1}. ${line}`).join("\n"), `Track it: ${trackUrl}`, end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(filingKinds[kind].title, concern),
      title: local ? "Received through *COMET*" : `We’ve received your *${kind === "candidacy" ? "candidacy" : "registration"}*`,
      preheader: `Your reference code is ${filing.referenceCode}. Keep this email as your receipt.`,
      blocks: [
        status("Pending review"),
        paragraph(escape(greeting)),
        paragraph(`${escape(intro)} This email is your receipt.`),
        highlight("Reference code", filing.referenceCode),
        details(summary),
        ...receiptBlocks(answers),
        heading("What happens next"),
        list(next.map(escape), true),
        button("Track it", trackUrl),
        ...end.blocks,
      ],
    }),
  };
}

/** The result. `remarks` is what the commission wrote with its decision, if anything: the reason, or what to do next. */
export function filingResultEmail(filing: Filing, approved: boolean, remarks = ""): Email {
  const { concern, kind } = filing;
  const local = isLocalConcern(concern);
  const words = wording[kind];
  const { title } = filingKinds[kind];
  const trackUrl = trackUrlOf(filing);
  const end = closing(filing);
  const greeting = `Hi ${greetingName(filing.filer.firstName)},`;
  const decider = local ? `The ${unitOf(concern)}` : "The commission";
  const relayed = local ? ` This result comes to you through the ${COMET}.` : "";
  const rows: Details = [[words.label, filing.subject], ["Filed with", unitOf(concern)], ["Reference code", filing.referenceCode]];
  const intro = approved
    ? `${decider} has ${kind === "candidacy" ? "accepted" : "approved"} ${words.yours}.${relayed}`
    : `${decider} has reviewed ${words.yours}, and it wasn’t ${kind === "candidacy" ? "accepted" : "approved"}.${relayed}`;
  const said = remarks.trim();

  return {
    to: filing.filer.email,
    subject: `${through(`${title}: ${approved ? words.approved.toLowerCase() : "result"}`, concern)} (${filing.referenceCode})`,
    text: [greeting, intro, said && `${local ? "The unit" : "The commission"} wrote:\n${said}`, detailsText(rows), `Track it: ${trackUrl}`, end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(title, concern),
      title: approved ? words.approvedTitle : `An update on your *${kind === "candidacy" ? "candidacy" : "registration"}*`,
      preheader: approved ? `${words.approved}: ${filing.subject}.` : `About ${words.yours}.`,
      blocks: [
        ...(approved ? [status(words.approved, "ok")] : []),
        paragraph(escape(greeting)),
        paragraph(approved ? `${escape(decider)} has ${kind === "candidacy" ? "accepted" : "approved"} ${escape(words.yours)}: ${strong(escape(filing.subject))}.${escape(relayed)}` : escape(intro)),
        ...(said ? [quote(said)] : []),
        details(rows),
        button("Track it", trackUrl),
        ...end.blocks,
      ],
    }),
  };
}

import "server-only";

import { formatClosing } from "@/lib/applications/period";
import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, heading, highlight, note, paragraph, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { receiptBlocks, receiptText, type ReceiptSection } from "@/lib/notifications/receipt";

// The emails someone requesting portal access gets: a receipt when they send the request, and the
// decision, with their details, when it's approved or declined under Accounts.
//
// A request is for the Central Comelec or for a college's Local Comelec (`concern`). Either way it
// leaves from the Central Comelec's mailbox, so one for a Local unit says it came through the
// Central Comelec's COMET (src/lib/notifications/concern.ts).

type Requester = { email: string; firstName: string; referenceCode: string; concern: Concern };

const TOPIC = "Commission Portal";

/** The blocks these emails end with for a Local unit: why the Central Comelec is writing. */
function closing(concern: Concern) {
  const relay = relayNote(concern, "your request");
  return { blocks: relay ? [divider(), note(escape(relay))] : [], text: relay };
}

/** The receipt: sent as soon as a request is saved, with what was sent and where to track it. */
export function accessReceivedEmail(requester: Requester, { answers, submittedAt }: { answers: ReceiptSection[]; submittedAt: string }): Email {
  const { concern } = requester;
  const local = isLocalConcern(concern);
  const trackUrl = `${siteUrl()}/apply/track?ref=${requester.referenceCode}`;
  const end = closing(concern);
  const greeting = `Hi ${greetingName(requester.firstName)},`;
  const intro = local
    ? `Your request for access to the Commission Portal as a member of the ${unitOf(concern)} was received through the ${COMET}. The unit’s Executive Board, or the Central Comelec’s, will review it.`
    : `We’ve received your request for access to the Commission Portal as a member of the Central Comelec. Its Executive Board will review it.`;
  const track = "To check on it, open Track application and enter your reference code with your student number or last name.";
  const summary: Details = [["Submitted", formatClosing(submittedAt)], ["Requested for", unitOf(concern)]];

  return {
    to: requester.email,
    subject: `${through("Portal access request received", concern)} (${requester.referenceCode})`,
    text: [greeting, `${intro} This email is your receipt.`, `Reference code: ${requester.referenceCode}`, detailsText(summary), receiptText(answers), `${track}\n${trackUrl}`, "We’ll email you again once it’s decided.", end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? "Request received through *COMET*" : "We’ve received your *request*",
      preheader: `Your reference code is ${requester.referenceCode}. Keep this email as your receipt.`,
      blocks: [
        status("Pending review"),
        paragraph(escape(greeting)),
        paragraph(`${escape(intro)} This email is your receipt.`),
        highlight("Reference code", requester.referenceCode),
        details(summary),
        ...receiptBlocks(answers),
        paragraph(`${escape(track)} We’ll email you again once it’s decided.`),
        button("Track your request", trackUrl),
        ...end.blocks,
      ],
    }),
  };
}

/**
 * To the unit a request is for, its official account and its Executive Board: someone asked for
 * access, and it's waiting under Accounts. Off until it's switched on under Email Sender → Automatic.
 * `rows` are the requester's details as they sent them.
 */
export function accessRequestNoticeEmail(recipients: string[], requester: Requester & { name: string }, rows: Details): Email {
  const { concern } = requester;
  const local = isLocalConcern(concern);
  const url = `${siteUrl()}/portal/accounts?status=pending`;
  const intro = local
    ? `Someone asked for access to the Commission Portal as a member of the ${unitOf(concern)}, through the ${COMET}. It’s waiting under Accounts for your unit’s Executive Board, or the Central Comelec’s, to approve or decline. Only your unit’s official account and Executive Board were told.`
    : `Someone asked for access to the Commission Portal as a member of the Central Comelec. It’s waiting under Accounts for the Executive Board to approve or decline. Only the Central Comelec’s official account and Executive Board were told.`;
  const all: Details = [...rows, ["Reference code", requester.referenceCode]];

  return {
    to: recipients.join(", "),
    subject: `${through("New portal access request", concern)}: ${requester.name} (${requester.referenceCode})`,
    text: ["Hi,", intro, detailsText(all), `Decide it under Accounts: ${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? "Request received through *COMET*" : "A new access *request*",
      preheader: `${requester.name} asked for portal access.`,
      blocks: [highlight("New access request", requester.name, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(all), button("Open Accounts", url)],
    }),
    replyTo: { name: greetingName(requester.name), address: requester.email },
  };
}

/**
 * The decision. `rows` are the requester's details: the account as it was added when approved (the
 * unit, position and role may differ from what they asked for), or the request as it was sent.
 */
export function accessDecisionEmail(requester: Requester, approved: boolean, rows: Details): Email {
  const { concern } = requester;
  const local = isLocalConcern(concern);
  const loginUrl = `${siteUrl()}/portal/login`;
  const end = closing(concern);
  const greeting = `Hi ${greetingName(requester.firstName)},`;
  const all: Details = [...rows, ["Reference code", requester.referenceCode]];
  const relayed = local ? ` This decision comes to you through the ${COMET}.` : "";

  if (approved) {
    const intro = `Your request for Commission Portal access was approved, and your account has been added to the ${unitOf(concern)}.${relayed}`;
    const signIn = "Sign in with Google using this UST account. What you can open follows your unit and position.";
    return {
      to: requester.email,
      subject: `${through("Portal access approved", concern)} (${requester.referenceCode})`,
      text: [greeting, intro, "Your account", detailsText(all), `${signIn}\n${loginUrl}`, "If any of these details is wrong, tell your Executive Board so they can correct it under Accounts.", end.text, COMMISSION].filter(Boolean).join("\n\n"),
      html: shell({
        eyebrow: topicFor(TOPIC, concern),
        title: "You’re cleared for *access*",
        preheader: "Your portal access was approved. Sign in with Google.",
        blocks: [
          status("Approved", "ok"),
          paragraph(escape(greeting)),
          paragraph(`Your request for Commission Portal access was approved, and your account has been added to the ${strong(escape(unitOf(concern)))}.${escape(relayed)}`),
          heading("Your account"),
          details(all),
          paragraph(escape(signIn)),
          button("Sign in to the portal", loginUrl),
          note("If any of these details is wrong, tell your Executive Board so they can correct it under Accounts."),
          ...end.blocks,
        ],
      }),
    };
  }

  const intro = `Your request for Commission Portal access as a member of the ${unitOf(concern)} wasn’t approved.${relayed}`;
  const next = `If you think this is a mistake, contact ${local ? "your unit’s" : "the Central Comelec’s"} Executive Board, or reply to this email. You can send a new request once it’s sorted out.`;
  return {
    to: requester.email,
    subject: `${through("Your portal access request", concern)} (${requester.referenceCode})`,
    text: [greeting, intro, next, "Your request", detailsText(all), end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: "An update on your *request*",
      preheader: "About your request for portal access.",
      blocks: [paragraph(escape(greeting)), paragraph(escape(intro)), paragraph(escape(next)), heading("Your request"), details(all), ...end.blocks],
    }),
  };
}

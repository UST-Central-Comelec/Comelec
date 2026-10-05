import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, escape, highlight, note, paragraph, quote, shell, siteUrl, type Details } from "@/lib/email/template";
import { describeStats } from "./diff";
import { approverRoles, awaitedRoles, codes, signedCount, type ApproverRole, type RevisionPerson, type RevisionSummary } from "./options";

// The emails a revision of the Constitution or the Elections Code sends, at every step: when it's
// sent for approval, each time one of the three signs it, and when it's published, sent back or
// withdrawn.
//
// Both texts are the Central Comelec's, so these go to the Central Comelec only: its official
// account and its Executive Board (src/lib/notifications/concern.ts), with the revision's editors,
// who may be Executive Associates. The three who sign get their own email when it's sent for
// approval, since it's theirs to act on; everyone else gets the one that only says so.

const EYEBROW = "Approvals";

const reviewUrl = (revision: RevisionSummary) => `${siteUrl()}/portal/apps/approvals/${revision.id}`;
const revisionUrl = (revision: RevisionSummary) => `${siteUrl()}/portal/${codes[revision.code].tab}/revisions/${revision.id}`;

const by = (person: RevisionPerson) => (person.role ? `${person.name}, ${person.role}` : person.name);

/** To the Chairperson, the Vice Chairperson and the Secretary to the Executive: a revision is waiting for them. */
export function approvalRequestEmail(recipients: string[], revision: RevisionSummary, sender: RevisionPerson): Email {
  const { title, the } = codes[revision.code];
  const url = reviewUrl(revision);
  const rows: Details = [["Text", title], ["Changes", describeStats(revision.stats)], ["Sent by", by(sender)]];
  const intro = `A revision of ${the} has been sent for approval. It’s published on the website once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} have all approved it.`;
  const next = "Open it in the Commission Portal to read what changes, then approve it or send it back with what should change.";

  return {
    to: recipients.join(", "),
    subject: `For your approval: a revision of ${the}`,
    text: ["Hi,", intro, detailsText(rows), "What changed and why:", revision.summary, `${next}\n${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: "For your *approval*",
      preheader: `A revision of ${the} is waiting for your approval.`,
      blocks: [highlight("Waiting for your approval", `A revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), quote(revision.summary), paragraph(escape(next)), button("Review the revision", url)],
    }),
    replyTo: { name: sender.name, address: sender.email },
  };
}

/** To the rest of the Central Comelec's Executive Board, its official account and the revision's editors: a revision is waiting for the three who sign. */
export function revisionSubmittedEmail(recipients: string[], revision: RevisionSummary, sender: RevisionPerson): Email {
  const { title, the } = codes[revision.code];
  const url = revisionUrl(revision);
  const rows: Details = [["Text", title], ["Changes", describeStats(revision.stats)], ["Sent by", by(sender)], ["Waiting for", approverRoles.join(", ")]];
  const intro = `A revision of ${the} has been sent for approval. It’s published on the website once the ${approverRoles.slice(0, -1).join(", the ")} and the ${approverRoles.at(-1)} have all approved it, and you’ll hear each time one of them does.`;
  const next = "There’s nothing for you to do. You can read what changes in the Commission Portal.";

  return {
    to: recipients.join(", "),
    subject: `Sent for approval: a revision of ${the}`,
    text: ["Hi,", intro, detailsText(rows), "What changed and why:", revision.summary, `${next}\n${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: "Sent for *approval*",
      preheader: `A revision of ${the} is waiting for approval.`,
      blocks: [highlight("Sent for approval", `A revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), quote(revision.summary), paragraph(escape(next)), button("Read the revision", url)],
    }),
    replyTo: { name: sender.name, address: sender.email },
  };
}

/** To the Central Comelec and the revision's editors: one of the three approved it, and it's still waiting for the others. */
export function revisionSignedEmail(recipients: string[], revision: RevisionSummary, signer: { name: string; role: ApproverRole }): Email {
  const { title, the } = codes[revision.code];
  const url = revisionUrl(revision);
  const signed = signedCount(revision);
  const awaited = awaitedRoles(revision);
  const rows: Details = [
    ["Text", title],
    ["Approved by", `${signer.name}, ${signer.role}`],
    ...approverRoles.map((role): Details[number] => [role, revision.approvals[role] ? `Approved · ${revision.approvals[role].name}` : "Waiting"]),
  ];
  const intro = `The ${signer.role} approved the revision of ${the}. That’s ${signed} of ${approverRoles.length}: it’s published once the ${awaited.join(" and the ")} ${awaited.length === 1 ? "has" : "have"} approved it too.`;

  return {
    to: recipients.join(", "),
    subject: `Approved by the ${signer.role} (${signed} of ${approverRoles.length}): the revision of ${the}`,
    text: ["Hi,", intro, detailsText(rows), `In the portal: ${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: `Approved by the *${signer.role}*`,
      preheader: `${signed} of ${approverRoles.length} approvals. Waiting for the ${awaited.join(" and the ")}.`,
      blocks: [highlight(`${signed} of ${approverRoles.length} approvals`, `The revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), button("Open the revision", url)],
    }),
  };
}

/** To the Central Comelec and the revision's editors: its editors took it back from approval. */
export function revisionWithdrawnEmail(recipients: string[], revision: RevisionSummary, withdrawnBy: RevisionPerson): Email {
  const { the } = codes[revision.code];
  const url = `${siteUrl()}/portal/${codes[revision.code].tab}`;
  const intro = `${by(withdrawnBy)} withdrew the revision of ${the} from approval to keep editing it. It’s a draft again, any approvals it had are cleared, and nothing is waiting to be signed. You’ll hear when it’s sent for approval again.`;

  return {
    to: recipients.join(", "),
    subject: `Withdrawn from approval: the revision of ${the}`,
    text: ["Hi,", intro, `In the portal: ${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: "Withdrawn from *approval*",
      preheader: `The revision of ${the} is a draft again.`,
      blocks: [highlight("Withdrawn from approval", `The revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), button("Open it in the portal", url)],
    }),
    replyTo: { name: withdrawnBy.name, address: withdrawnBy.email },
  };
}

/** To the Central Comelec and the revision's editors: it was sent back, and why. */
export function revisionReturnedEmail(recipients: string[], revision: RevisionSummary, returnedBy: { name: string; role: string; email: string }, reason: string): Email {
  const { the } = codes[revision.code];
  const url = `${siteUrl()}/portal/${codes[revision.code].tab}/edit`;
  const intro = `The ${returnedBy.role} sent the revision of ${the} back for changes:`;
  const next = "It’s a draft again, and any approvals it had are cleared. Its editors make the changes in the Commission Portal, then send it for approval again.";

  return {
    to: recipients.join(", "),
    subject: `Sent back for changes: the revision of ${the}`,
    text: ["Hi,", intro, reason, `${next}\n${url}`, `Sent back by ${returnedBy.name} (${returnedBy.email}).`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: "Sent back for *changes*",
      preheader: `The ${returnedBy.role} sent the revision of ${the} back for changes.`,
      blocks: [highlight("Sent back for changes", `The revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), quote(reason), paragraph(escape(next)), button("Open the draft", url), note(escape(`Sent back by ${returnedBy.name} (${returnedBy.email}).`))],
    }),
    replyTo: { name: returnedBy.name, address: returnedBy.email },
  };
}

/** To the Central Comelec and the revision's editors: all three signed, and the website shows it. */
export function revisionPublishedEmail(recipients: string[], revision: RevisionSummary): Email {
  const { title, the, path } = codes[revision.code];
  const pageUrl = `${siteUrl()}${path}`;
  const rows: Details = [["Text", title], ["Version", String(revision.version ?? revision.baseVersion + 1)], ["Changes", describeStats(revision.stats)], ...approverRoles.flatMap((role): Details => (revision.approvals[role] ? [[role, revision.approvals[role].name]] : []))];
  const intro = `The revision of ${the} has been approved by all three, and it’s now what the website shows.`;

  return {
    to: recipients.join(", "),
    subject: `Approved and published: the revision of ${the}`,
    text: ["Hi,", intro, detailsText(rows), `On the website: ${pageUrl}`, `In the portal: ${revisionUrl(revision)}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: EYEBROW,
      title: "Approved and *published*",
      preheader: `The revision of ${the} is approved, and the website shows it.`,
      blocks: [highlight("Approved and published", `The revision of ${the}`, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), button("See it on the website", pageUrl)],
    }),
  };
}

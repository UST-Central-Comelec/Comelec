import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, heading, highlight, link, list, note, paragraph, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { COMET, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "@/lib/notifications/concern";
import { receiptBlocks, receiptText, type ReceiptSection } from "@/lib/notifications/receipt";
import { interviewModes, slotDate, slotTimeRange, type InterviewSlot } from "./interview-format";
import { formatClosing } from "./period";

// The emails applicants get: a receipt when they submit, and the result when a commissioner accepts
// or rejects them in the portal. Built from the commission's email kit (src/lib/email/template.ts).
//
// An application is the Central Comelec's or a Local unit's, by where the applicant asked to serve
// (`concern`). Either way it leaves from the Central Comelec's mailbox, so one for a Local unit says
// it came through the Central Comelec's COMET (src/lib/notifications/concern.ts).

type Applicant = { email: string; firstName: string; referenceCode: string; position: string; division: string; concern: Concern };

const TOPIC = "Commissioner recruitment";

const trackUrlOf = (applicant: Applicant) => `${siteUrl()}/apply/track?ref=${applicant.referenceCode}`;

const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);

/** The blocks every one of these emails ends with: who to ask, and for a Local unit why the Central Comelec is writing. */
function closing(concern: Concern) {
  const relay = relayNote(concern, "your application");
  return { blocks: [divider(), help, ...(relay ? [note(escape(relay))] : [])], text: [helpText, relay].filter(Boolean).join("\n\n") };
}

/** "the Executive Division of the Central Comelec", in the email's HTML and in its text. */
const placeOf = (applicant: Applicant) => ({
  html: `the ${strong(escape(applicant.division))} of the ${isLocalConcern(applicant.concern) ? strong(escape(unitOf(applicant.concern))) : escape(unitOf(applicant.concern))}`,
  text: `the ${applicant.division} of the ${unitOf(applicant.concern)}`,
});

export type InterviewTime = Pick<InterviewSlot, "startsAt" | "durationMinutes" | "mode" | "location">;

export type Receipt = {
  /** The booked interview, or null when the division had no times open. */
  interview: InterviewTime | null;
  /** What the applicant answered, as the form's own receipt groups it (describeAnswers), without the interview: it has its own place in the email. */
  answers: ReceiptSection[];
  submittedAt: string;
};

/** The receipt: sent as soon as an application is saved, with what was submitted, the interview's date and time, and where to track it. */
export function confirmationEmail(applicant: Applicant, { interview, answers, submittedAt }: Receipt): Email {
  const { concern } = applicant;
  const local = isLocalConcern(concern);
  const trackUrl = trackUrlOf(applicant);
  const place = placeOf(applicant);
  const end = closing(concern);
  const greeting = `Hi ${greetingName(applicant.firstName)},`;
  const received = local ? `Your application was received through the ${COMET}, and it’s now pending the unit’s review.` : `We’ve received your application, and it’s now pending review.`;
  const reviewer = local ? "the unit" : "the commission";

  const when = interview && `${slotDate(interview.startsAt)}, ${slotTimeRange(interview.startsAt, interview.durationMinutes)}`;
  const where = interview && [interviewModes[interview.mode], interview.location].filter(Boolean).join(", ");
  const interviewNote = interview ? `${where}. Times are Philippine time. Please be on time; we’ll email you if anything changes.` : `Your interview isn’t scheduled yet: ${reviewer} will email you to set its date and time.`;
  const summary: Details = [["Submitted", formatClosing(submittedAt)], ["Applied to", unitOf(concern)]];
  const next = [
    interview ? `Come to your interview on ${when}.` : `Watch your inbox: ${reviewer} will email you to schedule your interview.`,
    `Check on your application any time: open Track application and enter your reference code with your student number or last name.`,
    `We’ll email you again once ${reviewer} has reached a decision.`,
  ];

  return {
    to: applicant.email,
    subject: `${through("Application received", concern)} (${applicant.referenceCode})`,
    text: [
      greeting,
      `Thank you for applying for ${applicant.position} in ${place.text}. ${received} This email is your receipt.`,
      `Reference code: ${applicant.referenceCode}`,
      interview ? `Your interview: ${when}\n${interviewNote}` : interviewNote,
      detailsText(summary),
      receiptText(answers),
      "What happens next",
      next.map((line, index) => `${index + 1}. ${line}`).join("\n"),
      `Track application: ${trackUrl}`,
      end.text,
      COMMISSION,
    ].join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? "Application received through *COMET*" : "We’ve received your *application*",
      preheader: `Your reference code is ${applicant.referenceCode}. Keep this email as your receipt.`,
      blocks: [
        status("Pending review"),
        paragraph(escape(greeting)),
        paragraph(`Thank you for applying for ${strong(escape(applicant.position))} in ${place.html}. ${escape(received)} This email is your receipt.`),
        highlight("Reference code", applicant.referenceCode),
        ...(when ? [highlight("Your interview", when, "name")] : []),
        note(escape(interviewNote)),
        details(summary),
        ...receiptBlocks(answers),
        heading("What happens next"),
        list(next.map(escape), true),
        button("Track application", trackUrl),
        ...end.blocks,
      ],
    }),
  };
}

/** What the unit's notice names of whoever applied. `id` is the application's own, for the link to it in the portal. */
export type NewApplication = Applicant & { id?: string; name: string; college: string; program: string };

/**
 * To the unit an application is for, its official account and its Executive Board: someone applied.
 * Off until it's switched on under Email Sender → Automatic: one of these per application adds up fast.
 */
export function applicationNoticeEmail(recipients: string[], application: NewApplication, interview: InterviewTime | null): Email {
  const { concern } = application;
  const local = isLocalConcern(concern);
  const url = `${siteUrl()}/portal/recruitment/applications${application.id ? `/${application.id}` : ""}`;
  const intro = local
    ? `An application to the ${unitOf(concern)} was submitted through the ${COMET}. It’s your unit’s to review, and only your unit’s official account and Executive Board were told.`
    : `An application to the Central Comelec was submitted on the website. Only the Central Comelec’s official account and Executive Board were told.`;
  const rows: Details = [
    ["Applicant", application.name],
    ["UST email", application.email],
    ["College or faculty", application.college],
    ["Program", application.program],
    ["Position", application.position],
    ["Division", application.division],
    ["Interview", interview ? `${slotDate(interview.startsAt)}, ${slotTimeRange(interview.startsAt, interview.durationMinutes)} · ${[interviewModes[interview.mode], interview.location].filter(Boolean).join(", ")}` : "Not scheduled yet"],
    ["Reference code", application.referenceCode],
  ];
  const next = "Open it in the Commission Portal to read the whole application. Replying to this email writes to the applicant.";

  return {
    to: recipients.join(", "),
    subject: `${through("New application received", concern)}: ${application.position} (${application.referenceCode})`,
    text: ["Hi,", intro, detailsText(rows), `${next}\n${url}`, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: local ? "Application received through *COMET*" : "A new *application*",
      preheader: `${greetingName(application.name)} applied for ${application.position}.`,
      blocks: [highlight("New application", application.name, "name"), paragraph("Hi,"), paragraph(escape(intro)), details(rows), paragraph(escape(next)), button("Open the application", url)],
    }),
    replyTo: { name: greetingName(application.name), address: application.email },
  };
}

/** The decision: sent when an application is accepted or rejected in the portal with "Email the applicant" ticked. */
export function resultEmail(applicant: Applicant, accepted: boolean): Email {
  const { concern } = applicant;
  const local = isLocalConcern(concern);
  const trackUrl = trackUrlOf(applicant);
  const place = placeOf(applicant);
  const end = closing(concern);
  const greeting = `Hi ${greetingName(applicant.firstName)},`;
  const rows: Details = [["Position", applicant.position], ["Division", applicant.division], ["Applied to", unitOf(concern)], ["Reference code", applicant.referenceCode]];
  const relayed = local ? ` This result comes to you through the ${COMET}.` : "";

  if (accepted) {
    const intro = local ? `Congratulations! The ${unitOf(concern)} has accepted you as ${applicant.position} in its ${applicant.division}.${relayed}` : `Congratulations! You’ve been accepted as ${applicant.position} in ${place.text}.`;
    const next = local ? `The unit will reach out soon with your next steps. Welcome to the commission.` : `The commission will reach out soon with your next steps. Welcome to the UST Central Comelec.`;
    return {
      to: applicant.email,
      subject: local ? `${through("You’re in! Application result", concern)} (${applicant.referenceCode})` : `You’re in! Your Central COMELEC application (${applicant.referenceCode})`,
      text: [greeting, intro, next, detailsText(rows), `Track application: ${trackUrl}`, end.text, COMMISSION].join("\n\n"),
      html: shell({
        eyebrow: topicFor(TOPIC, concern),
        title: "Welcome to the *commission*",
        preheader: `You’ve been accepted as ${applicant.position}.`,
        blocks: [
          status("Accepted", "ok"),
          paragraph(escape(greeting)),
          paragraph(
            local
              ? `Congratulations! The ${strong(escape(unitOf(concern)))} has accepted you as ${strong(escape(applicant.position))} in its ${strong(escape(applicant.division))}.${escape(relayed)}`
              : `Congratulations! You’ve been accepted as ${strong(escape(applicant.position))} in ${place.html}.`,
          ),
          highlight("Your position", applicant.position, "name"),
          paragraph(escape(next)),
          details(rows),
          button("Track application", trackUrl),
          ...end.blocks,
        ],
      }),
    };
  }

  const verdict = local ? `After careful review, the unit won’t be moving forward with your application this time.${relayed}` : `After careful review, we won’t be moving forward with your application this time.`;
  const thanks = `We appreciate your interest in serving the Thomasian community, and we hope you’ll apply again in a future cycle.`;
  return {
    to: applicant.email,
    subject: local ? `${through("Application result", concern)} (${applicant.referenceCode})` : `Your Central COMELEC application (${applicant.referenceCode})`,
    text: [greeting, `Thank you for applying for ${applicant.position} in ${place.text}. ${verdict}`, thanks, detailsText(rows), `Track application: ${trackUrl}`, end.text, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: "An update on your *application*",
      preheader: `About your application for ${applicant.position}.`,
      blocks: [
        paragraph(escape(greeting)),
        paragraph(`Thank you for applying for ${strong(escape(applicant.position))} in ${place.html}. ${escape(verdict)}`),
        paragraph(escape(thanks)),
        details(rows),
        note(`You can still see this decision under ${link(trackUrl, "Track application")}.`),
        ...end.blocks,
      ],
    }),
  };
}

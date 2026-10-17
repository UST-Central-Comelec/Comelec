import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, link, note, paragraph, quote, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { requirements } from "@/lib/polpar/content";
import { partyStatusLabel, unitName, type Party, type PartyStatus } from "./types";

// The emails a party's registration in the filing portal sends by itself (switches under Services → Email → Automatic):
// to the contact person when someone asks to join, to that person when they're answered, and to
// every member when the Comelec unit reviews a document or decides on the party.

type Person = { firstName: string; email: string };

const portalUrl = (path = "") => `${siteUrl()}/filing${path}`;
const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);
const greeting = (person: Person) => `Hi ${greetingName(person.firstName)},`;
const eyebrow = (party: Pick<Party, "college">) => `Political Party Registration · ${unitName(party.college)}`;

export const requirementLabel = (id: string) => requirements.find((item) => item.id === id)?.label ?? id;

/** To the contact person: `requester` asked to join their party. */
export function joinRequestEmail(contact: Person, requester: { name: string; email: string; college: string }, party: Pick<Party, "name" | "college">): Email {
  const rows: Details = [["Name", requester.name], ["UST email", requester.email], ["College or faculty", requester.college]];
  const intro = `${requester.name} has asked to join ${party.name} in the filing portal. As the party’s contact person, you decide who joins. They can’t see the party’s documents until you approve them.`;
  const url = portalUrl("/party/members");
  return {
    to: contact.email,
    subject: `${requester.name} asked to join ${party.name}`,
    text: [greeting(contact), intro, detailsText(rows), `Approve or decline: ${url}`, helpText, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: eyebrow(party),
      title: "Someone asked to *join*",
      preheader: `${requester.name} asked to join ${party.name}.`,
      blocks: [status("Waiting for you"), paragraph(escape(greeting(contact))), paragraph(escape(intro)), details(rows), button("Review the request", url), divider(), help],
    }),
  };
}

/** To someone who asked to join: the contact person's answer. */
export function joinDecisionEmail(member: Person, party: Pick<Party, "name" | "college">, approved: boolean): Email {
  const intro = approved
    ? `You’re now a member of ${party.name} in the filing portal. You can see and upload the party’s documents, download the templates, and read the Comelec unit’s feedback.`
    : `${party.name}’s contact person declined your request to join the party in the filing portal. If you think this is a mistake, talk to them, then sign up again.`;
  return {
    to: member.email,
    subject: approved ? `You’ve joined ${party.name}` : `Your request to join ${party.name}`,
    text: [greeting(member), intro, approved ? `Open the filing portal: ${portalUrl("/party")}` : "", helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(party),
      title: approved ? "You’re *in*" : "About your *request*",
      preheader: approved ? `You’re now a member of ${party.name}.` : `About your request to join ${party.name}.`,
      blocks: [...(approved ? [status("Member", "ok")] : []), paragraph(escape(greeting(member))), paragraph(escape(intro)), ...(approved ? [button("Open the filing portal", portalUrl("/party"))] : []), divider(), help],
    }),
  };
}

/** To a member: the unit approved a document, or sent it back with what to change. */
export function feedbackEmail(member: Person, party: Pick<Party, "name" | "college">, requirement: string, approved: boolean, feedback: string): Email {
  const unit = unitName(party.college);
  const label = requirementLabel(requirement);
  const intro = approved ? `The ${unit} approved ${label} for ${party.name}.` : `The ${unit} reviewed ${label} for ${party.name} and asked for changes. Update the files, then send it again from the filing portal.`;
  const said = feedback.trim();
  const url = portalUrl("/party");
  return {
    to: member.email,
    subject: approved ? `Approved: ${label}` : `Changes asked: ${label}`,
    text: [greeting(member), intro, said && `The unit wrote:\n${said}`, `Open your documents: ${url}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(party),
      title: approved ? "A document is *approved*" : "A document needs *changes*",
      preheader: approved ? `${label} is approved.` : `${label} needs changes.`,
      blocks: [status(approved ? "Approved" : "Changes asked", approved ? "ok" : "gold"), paragraph(escape(greeting(member))), paragraph(escape(intro)), ...(said ? [quote(said)] : []), button("Open your documents", url), divider(), help],
    }),
  };
}

/** To a member: the unit decided on the party itself. */
export function partyDecisionEmail(member: Person, party: Pick<Party, "name" | "college">, decision: Exclude<PartyStatus, "withdrawn">, remarks: string): Email {
  const unit = unitName(party.college);
  const intro = decision === "accredited"
    ? `The ${unit} has accredited ${party.name}.`
    : decision === "declined"
      ? `The ${unit} has reviewed ${party.name}’s registration, and it wasn’t accredited.`
      : `The ${unit} has reopened ${party.name}’s registration for review.`;
  const said = remarks.trim();
  return {
    to: member.email,
    subject: `${party.name}: ${partyStatusLabel[decision].toLowerCase()}`,
    text: [greeting(member), intro, said && `The unit wrote:\n${said}`, `Open the filing portal: ${portalUrl("/party")}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(party),
      title: decision === "accredited" ? "Your party is *accredited*" : "An update on your *party*",
      preheader: intro,
      blocks: [
        ...(decision === "accredited" ? [status("Accredited", "ok")] : []),
        paragraph(escape(greeting(member))),
        paragraph(decision === "accredited" ? `The ${escape(unit)} has accredited ${strong(escape(party.name))}.` : escape(intro)),
        ...(said ? [quote(said)] : []),
        button("Open the filing portal", portalUrl("/party")),
        divider(),
        help,
      ],
    }),
  };
}

/* Samples for Services → Email → Automatic, built by the same code. */

const sampleParty = (college: string | null) => ({ name: "LAKAS TOMASINO", college: college ?? "" });
const samplePerson = { firstName: "JUAN", email: "juan.delacruz@ust.edu.ph" };
export const joinRequestSample = (college: string | null) => joinRequestEmail(samplePerson, { name: "MARIA CLARA SANTOS", email: "maria.santos@ust.edu.ph", college: "College of Science" }, sampleParty(college));
export const joinDecisionSample = (college: string | null) => joinDecisionEmail(samplePerson, sampleParty(college), true);
export const feedbackSample = (college: string | null) => feedbackEmail(samplePerson, sampleParty(college), "members", false, "The roll lists 48 members, but the certification says 50. Correct the count and upload the signed roll again.");
export const partyDecisionSample = (college: string | null) => partyDecisionEmail(samplePerson, sampleParty(college), "accredited", "");

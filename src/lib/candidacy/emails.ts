import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, link, note, paragraph, quote, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { unitName } from "@/lib/party-portal/types";
import { candidacyRequirementLabel } from "./content";
import { candidacyStatusLabel, councilOf, type CandidacyStatus } from "./types";

// The emails a candidacy in the filing portal sends by itself (switches under Services → Email →
// Automatic): to a party's contact person when a member files under the party, to the candidate when
// the party answers, and to the candidate when the Comelec unit reviews a document or decides.

type Person = { firstName: string; email: string };
/** What the candidate filed: the office, the unit, and the filing's ID when there is one (FC-7K3M-9QXA). */
type Filed = { position: string; college: string; reference?: string };

const portalUrl = (path = "") => `${siteUrl()}/filing${path}`;
const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);
const greeting = (person: Person) => `Hi ${greetingName(person.firstName)},`;
const eyebrow = (filed: Filed) => ["Filing of Candidacy", unitName(filed.college), filed.reference].filter(Boolean).join(" · ");
const office = (filed: Filed) => `${filed.position}, ${councilOf(filed.college)}`;

/** To a party's contact person: a member filed their candidacy under the party, and asks for its endorsement. */
export function endorsementRequestEmail(contact: Person, candidate: { name: string; email: string }, party: { name: string }, filed: Filed): Email {
  const rows: Details = [["Candidate", candidate.name], ["UST email", candidate.email], ["Running for", office(filed)]];
  const intro = `${candidate.name} filed their certificate of candidacy under ${party.name}. As the party’s contact person, you endorse them before the filing goes to the ${unitName(filed.college)}.`;
  const url = portalUrl("/party/members");
  return {
    to: contact.email,
    subject: `${candidate.name} asks ${party.name} for its endorsement`,
    text: [greeting(contact), intro, detailsText(rows), `Endorse or decline: ${url}`, helpText, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: eyebrow(filed),
      title: "A candidate asks for your *endorsement*",
      preheader: `${candidate.name} filed under ${party.name}.`,
      blocks: [status("Waiting for you"), paragraph(escape(greeting(contact))), paragraph(escape(intro)), details(rows), button("Review the candidate", url), divider(), help],
    }),
  };
}

/** To the candidate: the party's answer. */
export function endorsementDecisionEmail(candidate: Person, party: { name: string }, filed: Filed, endorsed: boolean): Email {
  const intro = endorsed
    ? `${party.name} endorsed your candidacy for ${office(filed)}. Your filing now goes to the ${unitName(filed.college)} for review.`
    : `${party.name}’s contact person declined to endorse your candidacy for ${office(filed)}. If you think this is a mistake, talk to them. You can still run as an independent by filing again before the period closes.`;
  return {
    to: candidate.email,
    subject: endorsed ? `${party.name} endorsed your candidacy` : `About your candidacy under ${party.name}`,
    text: [greeting(candidate), intro, `Open the filing portal: ${portalUrl("/candidacy")}`, helpText, COMMISSION].join("\n\n"),
    html: shell({
      eyebrow: eyebrow(filed),
      title: endorsed ? "Your party *endorsed* you" : "About your *candidacy*",
      preheader: intro,
      blocks: [...(endorsed ? [status("Endorsed", "ok")] : []), paragraph(escape(greeting(candidate))), paragraph(escape(intro)), button("Open the filing portal", portalUrl("/candidacy")), divider(), help],
    }),
  };
}

/** To the candidate: the unit approved a document, or sent it back with what to change. */
export function candidacyFeedbackEmail(candidate: Person, filed: Filed, requirement: string, approved: boolean, feedback: string): Email {
  const unit = unitName(filed.college);
  const label = candidacyRequirementLabel(requirement);
  const intro = approved ? `The ${unit} approved your ${label.toLowerCase()}.` : `The ${unit} reviewed your ${label.toLowerCase()} and asked for changes. Update the files, then send it again from the filing portal.`;
  const said = feedback.trim();
  const url = portalUrl("/candidacy/documents");
  return {
    to: candidate.email,
    subject: approved ? `Approved: ${label}` : `Changes asked: ${label}`,
    text: [greeting(candidate), intro, said && `The unit wrote:\n${said}`, `Open your candidacy: ${url}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(filed),
      title: approved ? "A document is *approved*" : "A document needs *changes*",
      preheader: approved ? `${label} is approved.` : `${label} needs changes.`,
      blocks: [status(approved ? "Approved" : "Changes asked", approved ? "ok" : "gold"), paragraph(escape(greeting(candidate))), paragraph(escape(intro)), ...(said ? [quote(said)] : []), button("Open your candidacy", url), divider(), help],
    }),
  };
}

/** To the candidate: the unit decided on the candidacy. */
export function candidacyDecisionEmail(candidate: Person, filed: Filed, decision: Exclude<CandidacyStatus, "withdrawn">, remarks: string): Email {
  const unit = unitName(filed.college);
  const intro = decision === "qualified"
    ? `The ${unit} has found you qualified to run for ${office(filed)}.`
    : decision === "disqualified"
      ? `The ${unit} has reviewed your candidacy for ${office(filed)}, and you weren’t found qualified.`
      : `The ${unit} has reopened your candidacy for ${office(filed)} for review.`;
  const said = remarks.trim();
  return {
    to: candidate.email,
    subject: `Your candidacy: ${candidacyStatusLabel[decision].toLowerCase()}`,
    text: [greeting(candidate), intro, said && `The unit wrote:\n${said}`, `Open the filing portal: ${portalUrl("/candidacy")}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(filed),
      title: decision === "qualified" ? "You’re *qualified*" : "An update on your *candidacy*",
      preheader: intro,
      blocks: [
        ...(decision === "qualified" ? [status("Qualified", "ok")] : []),
        paragraph(escape(greeting(candidate))),
        paragraph(decision === "qualified" ? `The ${escape(unit)} has found you qualified to run for ${strong(escape(office(filed)))}.` : escape(intro)),
        ...(said ? [quote(said)] : []),
        button("Open the filing portal", portalUrl("/candidacy")),
        divider(),
        help,
      ],
    }),
  };
}

/** To the candidate: the unit recorded their withdrawal, on their sworn declaration (switch "candidacy-withdrawn"). */
export function candidacyWithdrawnEmail(candidate: Person, filed: Filed, reason: string): Email {
  const unit = unitName(filed.college);
  const intro = `The ${unit} recorded the withdrawal of your candidacy for ${office(filed)}. You can file again while filing is open.`;
  const said = reason.trim();
  return {
    to: candidate.email,
    subject: `Your candidacy for ${filed.position} is withdrawn`,
    text: [greeting(candidate), intro, said && `The unit wrote:\n${said}`, `Open the filing portal: ${portalUrl()}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: eyebrow(filed),
      title: "Your candidacy is *withdrawn*",
      preheader: intro,
      blocks: [paragraph(escape(greeting(candidate))), paragraph(escape(intro)), ...(said ? [quote(said)] : []), button("Open the filing portal", portalUrl()), divider(), help],
    }),
  };
}

/* Samples for Services → Email → Automatic, built by the same code. */

const samplePerson = { firstName: "JUAN", email: "juan.delacruz@ust.edu.ph" };
const sampleFiled = (college: string | null) => ({ position: "President", college: college ?? "", reference: "FC-4T8W-2HNC" });
export const endorsementRequestSample = (college: string | null) => endorsementRequestEmail(samplePerson, { name: "MARIA CLARA SANTOS", email: "maria.santos@ust.edu.ph" }, { name: "LAKAS TOMASINO" }, sampleFiled(college));
export const endorsementDecisionSample = (college: string | null) => endorsementDecisionEmail(samplePerson, { name: "LAKAS TOMASINO" }, sampleFiled(college), true);
export const candidacyFeedbackSample = (college: string | null) => candidacyFeedbackEmail(samplePerson, sampleFiled(college), "transcript", false, "The transcript isn’t certified by the Registrar. Upload the certified copy.");
export const candidacyDecisionSample = (college: string | null) => candidacyDecisionEmail(samplePerson, sampleFiled(college), "qualified", "");
export const candidacyWithdrawnSample = (college: string | null) => candidacyWithdrawnEmail(samplePerson, sampleFiled(college), "Received your sworn declaration of withdrawal on 20 October 2026.");

import "server-only";

import { accessDecisionEmail, accessReceivedEmail, accessRequestNoticeEmail } from "@/lib/access-requests/emails";
import { applicationNoticeEmail, confirmationEmail, resultEmail } from "@/lib/applications/emails";
import { approvalRequestEmail, revisionPublishedEmail, revisionReturnedEmail, revisionSignedEmail, revisionSubmittedEmail, revisionWithdrawnEmail } from "@/lib/codes/emails";
import type { RevisionSummary } from "@/lib/codes/options";
import type { Email } from "@/lib/email/send";
import { changeRequestEmail, registrationEmail, requestDecisionsEmail } from "@/lib/events/emails";
import type { CommissionEvent } from "@/lib/events/options";
import { filingReceivedEmail, filingResultEmail, type Filing } from "@/lib/filings/emails";
import { petitionNoticeEmail, petitionReceivedEmail, type Petition } from "@/lib/petitions/emails";
import { accountAccessEmail, accountAddedEmail, accountExpiredEmail, accountRemovedEmail, accountUpdatedEmail, type Account } from "./account-emails";
import { describeRecipients, isLocalConcern, type Concern } from "./concern";
import type { Actor } from "./notify";
import { periodChange, settingChangedEmail, type SettingChange } from "./settings-emails";
import { emailKeys, type EmailKey } from "./switches";

// Every email the site sends by itself, with when it goes and who gets it: what Apps → Email Sender
// → Automatic lists, each with its switch, and shows with made-up details. Each one's `id` is its
// switch (./switches.ts). The samples are built by the same code that sends the real ones, so the
// page shows what a recipient would see.

export type AutomaticEmail = {
  /** Its switch. */
  id: EmailKey;
  name: string;
  /** What sets it off. */
  when: string;
  /** Who gets it, for the concern it's shown with. */
  to: (concern: Concern) => string;
  /** False when it reads the same whichever unit it concerns: the commission's settings and texts are always the Central Comelec's. */
  byUnit: boolean;
  /** True while the form that would send it isn't built. */
  waiting?: boolean;
  /** What to know before switching it on, for one that's off to begin with. */
  caution?: string;
  sample: (concern: Concern) => Email;
};

export type AutomaticGroup = { label: string; emails: AutomaticEmail[] };

const SAMPLE_COLLEGE = "College of Science";

/** The Local unit the samples are shown with. */
export const sampleLocal: Concern = { unit: "local", college: SAMPLE_COLLEGE };

const at = "2026-10-05T01:15:00.000Z";
const by: Actor = { name: "Maria Santos", email: "maria.santos.sci@ust.edu.ph", role: "Chairperson, Central Comelec" };
const unitAddresses = ["comelec@ust.edu.ph", "maria.santos.sci@ust.edu.ph", "andres.reyes.ab@ust.edu.ph"];

const person = { email: "juan.delacruz.sci@ust.edu.ph", firstName: "JUAN PAOLO", referenceCode: "7K3MX" };
const applicant = (concern: Concern) => ({ ...person, referenceCode: "CC-7K3M-9QXA", position: "Executive Assistant to the Chairperson", division: "Executive Division", concern });
const requester = (concern: Concern) => ({ ...person, referenceCode: "PA-4T8W-2HNC", concern });

const aboutYou = {
  title: "About you",
  rows: [["Name", "DELA CRUZ, JUAN PAOLO R."], ["Student number", "2023123456"], ["Mobile number", "0917 123 4567"], ["UST email", person.email], ["College or faculty", SAMPLE_COLLEGE], ["Program", "Bachelor of Science in Biology, major in Medical Biology"], ["Year level", "3rd year"]] as Array<[string, string]>,
};

const applicationAnswers = (concern: Concern) => [
  aboutYou,
  { title: "Qualifications", rows: [["Requirements", "Meets all four"], ["Other office", "None"], ["Party, fraternity or sorority", "None"], ["Political organization", "None"]] as Array<[string, string]> },
  { title: "Position", rows: [["Serve in", isLocalConcern(concern) ? "Local Comelec" : "Central Comelec"], ["Division", "Executive Division"], ["Position", "Executive Assistant to the Chairperson"]] as Array<[string, string]> },
  { title: "Documents", rows: [["CV or résumé", "https://drive.google.com/file/d/1aBcD3fGhIjK/view"], ["Latest Registration Form", "https://drive.google.com/file/d/registration/view"], ["Letter of Intent", "https://drive.google.com/file/d/intent/view"], ["Recommendation Letter", "https://drive.google.com/file/d/1LmNoP7qRsTu/view"], ["Portfolio", "Not provided"], ["Latest Copy of Grades", "Not provided"]] as Array<[string, string]> },
];

const requestAnswers = (concern: Concern) => [
  aboutYou,
  { title: "Request", rows: [["Serves in", isLocalConcern(concern) ? "Local Comelec" : "Central Comelec"], ["Position", "Executive Associate"], ["Role", "Office of the Chairperson"], ["Access", "Commission Portal"]] as Array<[string, string]> },
];

const account = (concern: Concern): Account => ({
  name: "JUAN PAOLO R. DELA CRUZ",
  firstName: "JUAN PAOLO",
  email: person.email,
  kind: "personal",
  affiliation: concern.unit,
  college: SAMPLE_COLLEGE,
  position: "executive-associate",
  role: "Office of the Chairperson",
  program: "Bachelor of Science in Biology, major in Medical Biology",
  studentNumber: "2023123456",
});

const filing = (kind: Filing["kind"], concern: Concern): Filing => ({ kind, referenceCode: kind === "candidacy" ? "FC-6R2P-8YDM" : "PR-3V9K-5LQA", concern, filer: person, subject: kind === "candidacy" ? "President, Student Council" : "Lakas Tomasino Coalition", submittedAt: at });

const petition = (concern: Concern): Petition => ({
  referenceCode: "PC-9N4X-7BGE",
  type: "Petition",
  subject: "Extension of the campaign period",
  concern,
  submitter: { name: "Juan Paolo R. Dela Cruz", ...person },
  submittedAt: at,
  statement: "We ask the commission to extend the campaign period by three days, since classes were suspended for two of the days set for it.",
});

const revision: RevisionSummary = {
  id: "00000000-0000-4000-8000-000000000000",
  code: "elections-code",
  status: "pending",
  summary: "Moves the deadline for filing certificates of candidacy from ten to fourteen days before the campaign period, and renumbers the sections after it.",
  stats: { added: 1, removed: 0, edited: 3, moved: 0, articles: 0 },
  author: { name: "Lara Mendoza", email: "lara.mendoza.law@ust.edu.ph", role: "Legal Head" },
  submitted: { name: "Lara Mendoza", email: "lara.mendoza.law@ust.edu.ph", role: "Legal Head", at },
  approvals: { Chairperson: { name: "Maria Santos", email: by.email, at } },
  returned: null,
  events: [],
  baseVersion: 2,
  version: null,
  edits: 4,
  createdAt: at,
  updatedAt: at,
  updatedBy: "lara.mendoza.law@ust.edu.ph",
  decidedAt: null,
};
const signedByAll: RevisionSummary = {
  ...revision,
  status: "approved",
  version: 3,
  approvals: { ...revision.approvals, "Vice Chairperson": { name: "Andres Reyes", email: "andres.reyes.ab@ust.edu.ph", at }, "Secretary to the Executive": { name: "Sofia Lim", email: "sofia.lim.eng@ust.edu.ph", at } },
};

const sentence = (words: string) => `${words[0].toUpperCase()}${words.slice(1)}`;
const applicantOnly = () => "The applicant, at the UST account they verified";
const owner = () => "The account’s owner (for an official account, the unit’s mailbox)";
const centralOnly = () => sentence(describeRecipients({ unit: "central" }));
/** Every unit opens and closes its own Recruitment, Political Party Registration and Filing of Candidacy, and is the one told. */
const ownUnit = "The official account and Executive Board of the unit whose it is, Central or Local";
const centralAndEditors = () => `${centralOnly()}, and the revision’s editors`;

/** A change to a setting, as the email about it reads. */
const setting = (change: SettingChange) => () => settingChangedEmail(unitAddresses, change);

/** A close that's five minutes off whenever the page is opened, so the sample reads as the real one does. */
function closingSample() {
  const now = Date.now();
  const closesAt = new Date(now + 24 * 86_400_000).toISOString();
  return settingChangedEmail(
    unitAddresses,
    periodChange({ key: "setting-recruitment", what: "commissioner applications", section: "Recruitment", path: "/portal/recruitment/settings", before: { mode: "scheduled", closesAt, graceEndsAt: null }, after: { mode: "closed", closesAt, graceEndsAt: new Date(now + 5 * 60_000).toISOString() }, by })!,
  );
}

const event: CommissionEvent = {
  id: "voters-education-forum",
  createdAt: at,
  createdBy: "ana.cruz.sci@ust.edu.ph",
  updatedAt: at,
  updatedBy: "ana.cruz.sci@ust.edu.ph",
  name: "Voters’ Education Forum",
  summary: "What every Thomasian voter should know before election day.",
  background: "",
  eventDate: "2026-11-14",
  endDate: "2026-11-14",
  ingressTime: "12:30",
  startsTime: "13:00",
  endsTime: "16:00",
  egressTime: null,
  venueMode: "onsite",
  venueDetails: "Auditorium, Main Building",
  openToStudents: true,
  openToExternals: false,
  openToAdmins: false,
  registrationStatus: "open",
  requireGoogle: true,
  organizer: "local",
  college: SAMPLE_COLLEGE,
  changeRequest: null,
  changeRequestedBy: null,
  changeRequestedAt: null,
};

const requestRows = (concern: Concern): Array<[string, string]> => [["Name", "JUAN PAOLO R. DELA CRUZ"], ["UST email", person.email], ["Requested for", isLocalConcern(concern) ? `Local Comelec · ${SAMPLE_COLLEGE}` : "Central Comelec"], ["Position", "Executive Associate"], ["Role", "Office of the Chairperson"]];
const unitOnly = (concern: Concern) => `${sentence(describeRecipients(concern))}, and nobody else`;
const unitSample = (concern: Concern) => (isLocalConcern(concern) ? ["comelec.sci@ust.edu.ph", "ana.cruz.sci@ust.edu.ph"] : unitAddresses);
const VOLUME = "Off to begin with. One goes to the whole Executive Board for every submission, so in a busy period it can use up the mailbox’s daily sending limit, and the receipts with it.";

export const automaticEmails: AutomaticGroup[] = [
  {
    label: "Portal access requests",
    emails: [
      { id: "access-received", name: "Request received", when: "Someone sends a Request access form.", to: () => "The requester, at the UST account they verified", byUnit: true, sample: (concern) => accessReceivedEmail(requester(concern), { answers: requestAnswers(concern), submittedAt: at }) },
      { id: "access-notice", name: "New request, to the unit", when: "Someone sends a Request access form.", to: unitOnly, byUnit: true, caution: VOLUME, sample: (concern) => accessRequestNoticeEmail(unitSample(concern), { ...requester(concern), name: "JUAN PAOLO R. DELA CRUZ" }, requestRows(concern)) },
      {
        id: "access-approved",
        name: "Request approved",
        when: "A request is approved under Accounts.",
        to: () => "The requester",
        byUnit: true,
        sample: (concern) =>
          accessDecisionEmail(requester(concern), true, [["Name", "JUAN PAOLO R. DELA CRUZ"], ["UST email", person.email], ["Serves in", isLocalConcern(concern) ? `Local Comelec · ${SAMPLE_COLLEGE}` : "Central Comelec"], ["Position", "Executive Associate"], ["Role", "Office of the Chairperson"], ["Program", "Bachelor of Science in Biology, major in Medical Biology"], ["Student number", "2023123456"]]),
      },
      {
        id: "access-declined",
        name: "Request declined",
        when: "A request is declined under Accounts.",
        to: () => "The requester",
        byUnit: true,
        sample: (concern) => accessDecisionEmail(requester(concern), false, [["Name", "JUAN PAOLO R. DELA CRUZ"], ["UST email", person.email], ["Requested for", isLocalConcern(concern) ? `Local Comelec · ${SAMPLE_COLLEGE}` : "Central Comelec"], ["Position", "Executive Associate"], ["Role", "Office of the Chairperson"]]),
      },
    ],
  },
  {
    label: "Commissioner applications",
    emails: [
      {
        id: "application-received",
        name: "Application received",
        when: "An application is submitted on the Apply page.",
        to: applicantOnly,
        byUnit: true,
        sample: (concern) => confirmationEmail(applicant(concern), { interview: { startsAt: "2026-10-12T01:00:00.000Z", durationMinutes: 30, mode: "online", location: "Google Meet" }, answers: applicationAnswers(concern), submittedAt: at }),
      },
      {
        id: "application-notice",
        name: "New applicant, to the unit",
        when: "An application is submitted on the Apply page.",
        to: unitOnly,
        byUnit: true,
        caution: VOLUME,
        sample: (concern) =>
          applicationNoticeEmail(unitSample(concern), { ...applicant(concern), id: "00000000-0000-4000-8000-000000000000", name: "JUAN PAOLO R. DELA CRUZ", college: SAMPLE_COLLEGE, program: "Bachelor of Science in Biology, major in Medical Biology" }, { startsAt: "2026-10-12T01:00:00.000Z", durationMinutes: 30, mode: "online", location: "Google Meet" }),
      },
      { id: "application-accepted", name: "Application accepted", when: "An application is marked Accepted with “Email the applicant” ticked.", to: applicantOnly, byUnit: true, sample: (concern) => resultEmail(applicant(concern), true) },
      { id: "application-declined", name: "Application rejected", when: "An application is marked Rejected with “Email the applicant” ticked.", to: applicantOnly, byUnit: true, sample: (concern) => resultEmail(applicant(concern), false) },
    ],
  },
  {
    label: "Party registration and candidacy",
    emails: [
      { id: "party-received", name: "Party registration received", when: "A party registration is submitted.", to: () => "Whoever filed it", byUnit: true, waiting: true, sample: (concern) => filingReceivedEmail(filing("party-registration", concern)) },
      { id: "party-result", name: "Party registration result", when: "A party registration is approved or declined.", to: () => "Whoever filed it", byUnit: true, waiting: true, sample: (concern) => filingResultEmail(filing("party-registration", concern), true) },
      { id: "candidacy-received", name: "Certificate of candidacy received", when: "A certificate of candidacy is filed.", to: () => "Whoever filed it", byUnit: true, waiting: true, sample: (concern) => filingReceivedEmail(filing("candidacy", concern)) },
      {
        id: "candidacy-result",
        name: "Candidacy result",
        when: "A certificate of candidacy is accepted or declined.",
        to: () => "Whoever filed it",
        byUnit: true,
        waiting: true,
        sample: (concern) => filingResultEmail(filing("candidacy", concern), false, "The certificate of grades attached is for the wrong term. File again with this term’s before the filing period closes."),
      },
    ],
  },
  {
    label: "Petitions and cases",
    emails: [
      { id: "petition-received", name: "Submission received", when: "A petition or case is submitted.", to: () => "Whoever submitted it", byUnit: true, waiting: true, sample: (concern) => petitionReceivedEmail(petition(concern)) },
      {
        id: "petition-notice",
        name: "Notice to the unit",
        when: "A petition or case is submitted.",
        to: unitOnly,
        byUnit: true,
        waiting: true,
        sample: (concern) => petitionNoticeEmail(unitSample(concern), petition(concern)),
      },
    ],
  },
  {
    label: "Constitution and Elections Code",
    emails: [
      { id: "revision-approval", name: "For your approval", when: "A revision is sent for approval.", to: () => "The Chairperson, the Vice Chairperson and the Secretary to the Executive", byUnit: false, sample: () => approvalRequestEmail(unitAddresses, { ...revision, approvals: {} }, revision.author) },
      { id: "revision-submitted", name: "Sent for approval", when: "A revision is sent for approval.", to: () => `${centralOnly()} (those who don’t sign), and the revision’s editors`, byUnit: false, sample: () => revisionSubmittedEmail(unitAddresses, { ...revision, approvals: {} }, revision.author) },
      { id: "revision-signed", name: "An approval given", when: "One of the three approves a revision, and it’s still waiting for the others.", to: centralAndEditors, byUnit: false, sample: () => revisionSignedEmail(unitAddresses, revision, { name: "Maria Santos", role: "Chairperson" }) },
      { id: "revision-published", name: "Approved and published", when: "The last of the three approves a revision.", to: centralAndEditors, byUnit: false, sample: () => revisionPublishedEmail(unitAddresses, signedByAll) },
      {
        id: "revision-returned",
        name: "Sent back for changes",
        when: "One of the three sends a revision back.",
        to: centralAndEditors,
        byUnit: false,
        sample: () => revisionReturnedEmail(unitAddresses, revision, { name: "Andres Reyes", role: "Vice Chairperson", email: "andres.reyes.ab@ust.edu.ph" }, "Section 4 still says ten days in its second paragraph. Please make it fourteen there too."),
      },
      { id: "revision-withdrawn", name: "Withdrawn from approval", when: "Its editors take a revision back from approval.", to: centralAndEditors, byUnit: false, sample: () => revisionWithdrawnEmail(unitAddresses, revision, revision.author) },
    ],
  },
  {
    label: "Events",
    emails: [
      { id: "event-registered", name: "Registered", when: "Someone registers for an event, whether or not they were on its waitlist first.", to: () => "Whoever registered, at the email they registered with", byUnit: false, sample: () => registrationEmail(person, event, "registered") },
      { id: "event-waitlisted", name: "On the waitlist", when: "Someone joins an event’s waitlist, while its registration hasn’t opened.", to: () => "Whoever joined, at the email they registered with", byUnit: false, sample: () => registrationEmail(person, event, "waitlisted") },
      {
        id: "event-request",
        name: "Logistics request answered",
        when: "The organizing unit saves its answers to what a registrant asked for under Logistics. One email lists every answer that changed in that save, each approved or not available.",
        to: () => "Whoever asked, at the email they registered with",
        byUnit: false,
        sample: () => requestDecisionsEmail(person, event, [{ kind: "parking", approved: true, detail: "ABC 1234 · White Toyota Vios · arriving 12:30 PM" }, { kind: "certificate", approved: true, detail: "" }, { kind: "dietary", approved: false, detail: "Peanuts, shellfish" }], 1),
      },
      {
        id: "event-changes",
        name: "Changes requested",
        when: "The Central Comelec asks a Local unit to change one of its events.",
        to: () => "That unit’s commissioners",
        byUnit: false,
        sample: () => changeRequestEmail(["comelec.sci@ust.edu.ph", "ana.cruz.sci@ust.edu.ph"], event, "Please move the start to 1:30 PM: the auditorium is booked until 1:00.", { name: by.name, email: by.email }),
      },
    ],
  },
  {
    label: "Settings changes",
    emails: [
      { id: "setting-recruitment", name: "Recruitment", when: "A unit’s commissioner applications are opened, scheduled or closed, or the open slots change.", to: () => `${ownUnit}. A change to the open slots goes to ${describeRecipients({ unit: "central" })}`, byUnit: false, sample: closingSample },
      {
        id: "setting-filings",
        name: "Party registration and candidacy",
        when: "A unit’s party registration or filing of candidacy is opened, scheduled or closed.",
        to: () => ownUnit,
        byUnit: false,
        sample: () =>
          settingChangedEmail(
            unitAddresses,
            periodChange({ key: "setting-filings", what: "the filing of candidacy", section: "Filing of Candidacy", path: "/portal/candidacy/settings", before: { mode: "closed", closesAt: null, graceEndsAt: null }, after: { mode: "open", closesAt: null, graceEndsAt: null }, by })!,
          ),
      },
      {
        id: "setting-site",
        name: "Maintenance and the cookie notice",
        when: "The website goes under maintenance or comes back, its maintenance message changes, or the cookie notice is shown, hidden or reset.",
        to: centralOnly,
        byUnit: false,
        sample: setting({
          key: "setting-site",
          section: "Maintenance",
          headline: "The website is under maintenance",
          title: "The website is under *maintenance*",
          summary: `${by.name} put the public website under maintenance. Visitors see the maintenance page until it’s switched back to Live; the Commission Portal stays up.`,
          rows: [["Website", "Under maintenance"], ["Before", "Live"], ["Message shown", "We’re updating the candidates’ pages. Back by 6 PM."]],
          by,
          path: "/portal/maintenance",
        }),
      },
      {
        id: "setting-access",
        name: "Access Control and expiration",
        when: "What a level of account can open changes under Accounts → Access Control, or the date commissioners’ access ends changes.",
        to: centralOnly,
        byUnit: false,
        sample: setting({
          key: "setting-access",
          section: "Access Control",
          headline: "What Deputies can open changed",
          title: "Portal access *changed*",
          summary: `${by.name} changed which tabs of the Commission Portal are open to Deputies. It applies to every account at that level from their next click.`,
          rows: [["Level", "Deputies"], ["Now also open", "Publications → News"], ["No longer open", "Recruitment → Slots"]],
          by,
          path: "/portal/accounts/access-control?level=deputy",
        }),
      },
      {
        id: "setting-email",
        name: "Automatic emails",
        when: "An automatic email is switched off or on under Apps → Email Sender → Automatic.",
        to: centralOnly,
        byUnit: false,
        sample: setting({
          key: "setting-email",
          section: "Automatic emails",
          label: "Automatic emails",
          headline: "1 email switched on, 1 switched off",
          title: "Automatic emails *changed*",
          summary: `${by.name} changed which emails the site sends by itself.`,
          rows: [["Switched on", "Commissioner applications: New applicant, to the unit"], ["Switched off", "Accounts: Details or access updated"]],
          by,
          path: "/portal/apps/email/automatic",
        }),
      },
    ],
  },
  {
    label: "Accounts",
    emails: [
      { id: "account-added", name: "Account added", when: "An account is added by hand under Accounts.", to: owner, byUnit: true, sample: (concern) => accountAddedEmail(account(concern), by) },
      {
        id: "account-updated",
        name: "Details or access updated",
        when: "An account’s details are saved with something changed, by its owner or by whoever manages it; or a Local Chairperson is made Primus or Vicar.",
        to: owner,
        byUnit: true,
        sample: (concern) => accountUpdatedEmail(account(concern), [["Position", "Executive Associate (was Deputy)"], ["Role", "Office of the Chairperson (was Deputy)"]], by, { access: true }),
      },
      { id: "account-revoked", name: "Access revoked", when: "An account’s access is revoked under Accounts.", to: owner, byUnit: true, sample: (concern) => accountAccessEmail(account(concern), false, by) },
      { id: "account-restored", name: "Access restored", when: "An account’s access is restored under Accounts.", to: owner, byUnit: true, sample: (concern) => accountAccessEmail(account(concern), true, by) },
      { id: "account-expired", name: "Access ended", when: "The date set under Accounts → Expiration passes, and commissioners’ accounts are revoked.", to: () => "Every commissioner whose access ended", byUnit: true, sample: (concern) => accountExpiredEmail(account(concern), "2027-06-30") },
      { id: "account-removed", name: "Account removed", when: "An account is deleted under Accounts.", to: owner, byUnit: true, sample: (concern) => accountRemovedEmail(account(concern), by) },
    ],
  },
];

const everyEmail = automaticEmails.flatMap((group) => group.emails);

export const findAutomaticEmail = (id: string | undefined) => everyEmail.find((email) => email.id === id);

/**
 * Who an email goes to, whichever unit it concerns: a notice to the commission goes to the one unit
 * it's about, so it's said that way rather than naming one.
 */
export const describeTo = (email: AutomaticEmail) => (email.to({ unit: "central" }) === email.to(sampleLocal) ? email.to({ unit: "central" }) : "The official account and Executive Board of the unit it concerns (the Central Comelec, or that college’s), and nobody else");

/** An email as the settings and the notices name it: "Accounts: Access revoked". */
export const emailName = (key: EmailKey) => {
  const group = automaticEmails.find((item) => item.emails.some((email) => email.id === key));
  return `${group?.label}: ${group?.emails.find((email) => email.id === key)?.name}`;
};

// Every switch has its email here, and every email its switch: a mismatch is a mistake in one of the two lists.
const listed = new Set<string>(everyEmail.map((email) => email.id));
const unlisted = emailKeys.filter((key) => !listed.has(key));
if (unlisted.length || listed.size !== everyEmail.length) throw new Error(`The automatic emails and their switches don’t match: ${unlisted.join(", ") || "an email is listed twice"}.`);

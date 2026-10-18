// The documents someone agrees to while requesting portal access (Request access on the sign-in
// page): the Data Privacy Notice at the start, then the onboarding declarations and portal policies.
// Edited under Legals → Documents → Onboarding; every save is a new version
// (supabase/migrations/0074_onboarding_declarations.sql), and each acceptance records the version
// that was shown. The texts below are version 1. Once anyone has accepted them, change a text in
// the portal, not here, so version 1 keeps meaning the same words.
//
// Texts use a light format: a blank line between paragraphs, "## " for a heading, "- " for a
// bullet, "1. " for a numbered item.
//
// Free of server-only imports: the request form, the editor and the Directory read it.

export const onboardingDocumentKeys = [
  "privacy-notice",
  "membership-agreement",
  "code-of-conduct",
  "confidentiality",
  "neutrality",
  "recusal",
  "intellectual-property",
  "terms-of-service",
  "acceptable-use",
  "privacy-policy",
  "officer-acceptance",
] as const;

export type DefaultOnboardingDocumentKey = (typeof onboardingDocumentKeys)[number];
export type OnboardingDocumentKey = DefaultOnboardingDocumentKey | `custom-${string}`;

export const isOnboardingDocumentKey = (value: unknown): value is OnboardingDocumentKey => typeof value === "string" && ((onboardingDocumentKeys as readonly string[]).includes(value) || /^custom-[0-9a-f-]{36}$/.test(value));

/** The editable parts of a document. `statement` is what the requester ticks to agree. */
export type OnboardingText = { title: string; statement: string; body: string };

export type OnboardingDocument = OnboardingText & {
  key: OnboardingDocumentKey;
  /** 1 is the text below; each save in the portal adds one. */
  version: number;
  savedAt: string | null;
  savedBy: string | null;
};

/** One accepted document, as it's kept on the request and then on the account. */
export type Declaration = { key: OnboardingDocumentKey; title: string; version: number; acceptedAt: string };

export const TEXT_LIMITS = { title: 120, statement: 300, body: 60_000 } as const;

/**
 * The request form's steps, in order. Step 0 is the privacy notice; step 1 the profile; the
 * documents follow; the last step submits. `group` heads each run of steps in the step list.
 */
export const onboardingSteps = [
  { id: "privacy-notice", label: "Data Privacy Notice and Consent", group: "Before you start" },
  { id: "profile", label: "Profile", group: "Before you start" },
  { id: "membership-agreement", label: "Membership Agreement", group: "Onboarding forms" },
  { id: "code-of-conduct", label: "Code of Conduct and Nonpartisanship", group: "Onboarding forms" },
  { id: "confidentiality", label: "Confidentiality Agreement", group: "Onboarding forms" },
  { id: "neutrality", label: "Declaration of Neutrality and Impartiality", group: "Onboarding forms" },
  { id: "recusal", label: "Recusal Undertaking", group: "Onboarding forms" },
  { id: "intellectual-property", label: "Intellectual Property", group: "Portal policies" },
  { id: "terms-of-service", label: "Terms of Service", group: "Portal policies" },
  { id: "acceptable-use", label: "Acceptable Use Policy", group: "Portal policies" },
  { id: "privacy-policy", label: "Privacy Policy", group: "Portal policies" },
  { id: "officer-acceptance", label: "Officer Acceptance and Turnover", group: "Taking office" },
  { id: "submit", label: "Submit", group: "Taking office" },
] as const satisfies ReadonlyArray<{ id: OnboardingDocumentKey | "profile" | "submit"; label: string; group: string }>;

export type OnboardingStepId = OnboardingDocumentKey | "profile" | "submit";

export type OnboardingStep = { key: OnboardingDocumentKey | "profile"; hidden: boolean; deleted: boolean };
export const defaultOnboardingLayout = (): OnboardingStep[] => onboardingSteps.filter(step => step.id !== "submit").map(step => ({ key: step.id as OnboardingDocumentKey | "profile", hidden: false, deleted: false }));

/** Build the live request flow from the visible documents, keeping privacy and profile fixed. */
export function requestOnboardingSteps(documents: OnboardingDocument[]) {
  const privacy = documents.find(document => document.key === "privacy-notice");
  if (!privacy) throw new Error("The privacy notice is missing.");
  const documentStep = (document: OnboardingDocument) => ({ id: document.key as OnboardingStepId, label: document.title, group: document.key === "privacy-notice" ? "Before you start" : "Onboarding forms" });
  return [documentStep(privacy), { id: "profile" as OnboardingStepId, label: "Profile", group: "Before you start" }, ...documents.filter(document => document.key !== "privacy-notice").map(documentStep), { id: "submit" as OnboardingStepId, label: "Submit", group: "Review" }];
}

/** "Step 3", as the editor and the form name a document's place. */
export const stepOf = (key: OnboardingDocumentKey) => onboardingSteps.findIndex((step) => step.id === key);

export const defaultDocuments: Record<DefaultOnboardingDocumentKey, OnboardingText> = {
  "privacy-notice": {
    title: "Data Privacy Notice and Consent Form",
    statement: "I have read and understood this Notice, and I freely and expressly consent to the collection and processing of my personal data by the UST Central Commission on Elections for the purposes stated herein.",
    body: `The UST Central Commission on Elections (“the Commission”) recognizes its obligation to protect the personal data entrusted to it. This Notice sets forth the personal data the Commission collects when a person requests access to the Commission Portal (“the Portal”) and completes onboarding, the purposes for which such data are processed, the persons to whom they are disclosed, and the measures by which they are protected. It is issued in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and Regulations, and the data privacy policies of the University of Santo Tomas (“the University”).

## 1. Personal data collected
The Commission collects the following:
- full name, student number, UST email address, mobile number and Facebook profile link;
- college or faculty, academic program and year level;
- unit, position and role in the Commission;
- where the person was recruited, the particulars of the accepted application;
- the acceptance of each onboarding document, together with the date and time of acceptance; and
- records of activity in the Portal, including sign-ins and changes made.

## 2. Purposes of processing
Personal data are processed for the following purposes:
- to verify that the person is a bona fide student of the University and a Member of the Commission;
- to create and administer the person’s Portal account and determine the access it grants;
- to list the person in the Commission’s Directory and, where the role so requires, in “Meet the commission” on the Commission’s website;
- to communicate with the person on duties, meetings and other official matters;
- to keep a record of undertakings and declarations, as the Constitution, the Elections Code and University rules require; and
- to secure the Portal and investigate any misuse of it.

## 3. Disclosure
Personal data are accessible to the Executive Board and to the officers charged with administering accounts for the person’s unit. The person’s name, role, unit, UST email address, Facebook profile link and photograph are shown in the Directory to other Members. The name, role and photograph may be published on the Commission’s public website.

The Commission does not sell personal data, and does not disclose them outside the University except where the law requires or the person consents. Service providers engaged to host the Portal and its files process personal data on the Commission’s behalf and under appropriate contractual and technical safeguards.

## 4. Retention
- A request for access is deleted sixty (60) days after its submission.
- A Member’s account and declarations are retained for the duration of service and for up to one (1) academic year after the end of the Member’s term, for purposes of turnover and accountability. They are thereafter deleted or anonymized, unless the law or a pending case requires their longer retention.

## 5. Security measures
Only verified UST Google accounts may sign in to the Portal. All connections are encrypted, and each Member is granted access only to what the Member’s position requires. Members who handle personal data are bound by the Confidentiality Agreement.

## 6. Rights of the data subject
Under the Data Privacy Act of 2012, the data subject has the right to be informed, to access, to object, to rectification, to erasure or blocking, to data portability, to damages, and to file a complaint with the National Privacy Commission. Any of these rights may be exercised by writing to comelec@ust.edu.ph. The data subject may also contact the University’s Data Protection Officer.

## 7. Consent
By ticking the box below, the person certifies that they have read and understood this Notice, that the information they provide is true and correct, and that they freely and expressly consent to the processing of their personal data for the purposes stated herein. Consent may be withdrawn at any time by written notice to the Commission. Withdrawal of consent shall terminate the person’s access to the Portal, as the Portal cannot operate without it.`,
  },

  "membership-agreement": {
    title: "Membership Agreement",
    statement: "I have read and understood the Membership Agreement, and I agree to be bound by its terms.",
    body: `This Membership Agreement (“the Agreement”) is entered into by and between the undersigned (“the Member”) and the UST Central Commission on Elections (“the Commission”). It shall take effect upon the submission of the Member’s onboarding.

## 1. Admission
1. The Member is admitted to the Commission in the unit, position and role stated in the Member’s profile. The Member’s unit is either the Central Comelec or the Local Comelec of the Member’s college or faculty.
2. Membership is personal and non-transferable. The Member’s Portal account is for the Member’s sole and exclusive use.
3. The Member’s term shall run for the current academic year, or until the Member’s resignation or removal, whichever occurs first.

## 2. Eligibility
The Member represents and warrants that:
- the Member is a bona fide and currently enrolled student of the University of Santo Tomas;
- the Member is in good academic and disciplinary standing;
- the Member possesses the qualifications that the Constitution and the Elections Code prescribe for the Member’s position; and
- the information in the Member’s profile is true, correct and complete.

The Member shall notify the Executive Board without delay should any of the foregoing cease to be true.

## 3. Duties
The Member shall:
- uphold the Constitution, the Elections Code, and the resolutions and rules of the Commission;
- perform the tasks assigned by the Member’s office faithfully, competently and on time;
- attend the meetings, trainings and election duties to which the Member is called, or give prior notice of inability to attend;
- keep the Member’s profile accurate and up to date; and
- observe the rules of the University and the Code of Conduct, and accord fellow Members due respect.

## 4. Authority to act for the Commission
The Commission acts as a collegial body, under the authority vested in it by the Constitution. No Member may speak or act for the Commission, or bind it to any obligation, without such authority.

## 5. Resignation and removal
1. The Member may resign by written notice to the Chairperson of the Member’s unit, given at least fifteen (15) days in advance where practicable, and shall complete turnover before leaving office.
2. The Member may be suspended or removed for any breach of this Agreement or of any onboarding document, in accordance with the procedure laid down by the Constitution, the Elections Code and the rules of the Commission. The Member shall be afforded due process before any decision is rendered.
3. The Member’s access to the Portal shall terminate upon the end of the Member’s membership.

## 6. Nature of service
Membership is voluntary service. Nothing in this Agreement creates an employer–employee relationship between the Member and the Commission or the University, and the Member shall receive no compensation for the Member’s service.

## 7. Entire agreement
This Agreement, together with the other onboarding documents the Member accepts, constitutes the entire undertaking of the Member. In case of conflict between any of them and the Constitution or the Elections Code, the latter shall prevail.`,
  },

  "code-of-conduct": {
    title: "Code of Conduct and Nonpartisanship Agreement",
    statement: "I have read and understood the Code of Conduct and Nonpartisanship Agreement, and I agree to abide by it.",
    body: `The authority of the Commission rests upon the trust of the Thomasian electorate. This Code prescribes the standards of conduct required of every Member, within and outside the election period.

## 1. Integrity
- The Member shall act with honesty at all times, and shall never falsify, conceal or alter any record, result or document.
- The Member shall never solicit or accept any gift, favour, food, money or other thing of value from a candidate, a political party, or any person acting on their behalf.
- The Member shall report to the Executive Board any attempt to influence the Member or any other Member.

## 2. Professional conduct
- The Member shall treat students, candidates, parties, fellow Members and University personnel with courtesy and respect, and shall refrain from any form of discrimination or harassment.
- The Member shall be punctual, prepared and responsive in the discharge of the Member’s duties.
- The Member shall use the name, logo and channels of the Commission only for official purposes and only with due authority.

## 3. Nonpartisanship
For the duration of membership, the Member shall not:
1. join, run under, or hold office in any student political party or coalition;
2. seek any elective student position;
3. campaign for or against any candidate, party or position, whether in person or online, including through reactions, shares, comments, profile frames or endorsements;
4. assist in the preparation of any candidate’s or party’s campaign, filing or materials;
5. disclose non-public information on any election to any person outside the Commission; or
6. express a public opinion on any candidate, party or pending case.

The Member shall resign from any party to which the Member belongs before assuming office, and shall so state in the Declaration of Neutrality and Impartiality.

## 4. Social media
The Member’s personal accounts remain the Member’s own; however, what the Member posts reflects upon the Commission. On election matters, the Member shall share only the official announcements of the Commission, without comment.

## 5. Sanctions
Any breach of this Code may result in a warning, suspension or removal, and in referral to the University where its rules apply.`,
  },

  confidentiality: {
    title: "Confidentiality Agreement",
    statement: "I have read and understood the Confidentiality Agreement, and I agree to be bound by its terms.",
    body: `In the course of the Member’s duties, the Member will have access to information that is not public, including the personal data of students, applicants and candidates; case records; deliberations; draft resolutions; election materials; and the contents of the Commission Portal (collectively, “Confidential Information”).

## 1. Obligations of the Member
The Member shall:
1. use Confidential Information solely for the performance of the Member’s duties;
2. not disclose Confidential Information to any person outside the Commission, or to any Member who does not require it for their duties, unless authorized by the Executive Board or required by law;
3. not copy, download, capture, forward or remove Confidential Information from the official tools of the Commission, except as the Member’s duties require;
4. keep in strict confidence the deliberations of the Commission, the En Banc and every chamber, including the vote of each Member; and
5. process personal data in accordance with the Data Privacy Act of 2012, and report any loss, leak or unauthorized access to the Executive Board within twenty-four (24) hours of learning of it.

## 2. Exceptions
The foregoing obligations shall not apply to information that has become public through no fault of the Member, or that the Member is compelled to disclose by law or by lawful order. In the latter case, the Member shall, wherever possible, notify the Commission before making the disclosure.

## 3. Duration
These obligations shall take effect upon the submission of the Member’s onboarding and shall survive the termination of the Member’s membership.

## 4. Return of materials
Upon the end of membership, the Member shall surrender every document, file and account in the Member’s custody, and shall delete all copies in the Member’s possession, as part of turnover.

## 5. Sanctions
Any breach of this Agreement may result in removal, referral to the University, and liability under the Data Privacy Act of 2012 and other applicable laws.`,
  },

  neutrality: {
    title: "Declaration of Neutrality and Impartiality",
    statement: "I make this Declaration of Neutrality and Impartiality freely, and I certify that its contents are true and correct.",
    body: `I, the Member named in this onboarding, of legal age and a student of the University of Santo Tomas, hereby declare that:

1. I am not a member, officer, candidate or volunteer of any student political party or coalition, and I will not become one for the duration of my service.
2. I am not a candidate for any elective student position, and I will not file a certificate of candidacy for the duration of my service.
3. I have no relationship with any candidate or party officer that would impair my ability to act fairly. Where any such relationship exists, I have disclosed it, or shall disclose it, to the Executive Board in accordance with the Recusal Undertaking.
4. I shall decide every matter on its merits, on the evidence and the applicable rules alone, without fear or favour, and without regard to the identity of any candidate or party.
5. I shall apply the Constitution and the Elections Code equally to every candidate, party and voter.
6. I will not allow any personal interest, friendship, affiliation or loyalty to influence the performance of my duties in the Commission.
7. I understand that should this Declaration be false, or should it cease to be true and I fail to report it, I may be removed from the Commission.

I make this Declaration freely and voluntarily, and I affirm it by my electronic acceptance.`,
  },

  recusal: {
    title: "Recusal Undertaking",
    statement: "I have read and understood the Recusal Undertaking, and I bind myself to its terms.",
    body: `A Member shall inhibit from any matter in which the Member’s impartiality might reasonably be questioned. This Undertaking sets forth the grounds and the manner of recusal.

## 1. Grounds for recusal
I shall take no part in any matter, including its discussion, investigation, deliberation, vote or implementation, where:
- I am related within the fourth (4th) civil degree of consanguinity or affinity to any candidate, party officer, petitioner or respondent involved;
- I am, or have been within the past twelve (12) months, a member, officer or volunteer of any party involved;
- I have a close personal, romantic, business or organizational relationship with any person involved;
- I have previously expressed a public opinion on the matter; or
- any other circumstance would lead a fair-minded observer to doubt my impartiality.

## 2. Manner of recusal
1. I shall disclose the conflict in writing to the Chairperson of my unit as soon as I become aware of it, and before the matter is taken up. Where the conflict involves the Chairperson, I shall make the disclosure to the Vice Chairperson.
2. I shall excuse myself from any meeting while the matter is discussed and decided, and I will not attempt to influence any person who decides it.
3. I will not access the records of the matter, whether in the Commission Portal or elsewhere.
4. My recusal, and the ground for it, shall be entered in the minutes.

## 3. Motions for recusal
Where any party moves for my recusal, I shall submit the motion to the Executive Board for resolution, and I shall abide by its decision.

## 4. Consequences of failure to recuse
I understand that any failure to disclose a conflict, or to recuse, may render my participation in the matter void, and may be a ground for my removal.`,
  },

  "intellectual-property": {
    title: "Intellectual Property Agreement",
    statement: "I have read and understood the Intellectual Property Agreement, and I agree to be bound by its terms.",
    body: `## 1. Works created for the Commission
All works the Member creates in the course of the Member’s duties, including resolutions, memoranda, reports, designs, publication materials, photographs, videos, software, forms and templates (“Commission Works”), are created for the Commission. The Member agrees that:
1. the Commission may use, reproduce, adapt, publish and distribute Commission Works, without limitation as to time and without compensation to the Member;
2. to the extent the Member holds copyright in any Commission Work, the Member hereby assigns it to the Commission or, where assignment is not legally possible, grants the Commission an exclusive, perpetual and royalty-free licence to it; and
3. the Member shall not publish, sell or reuse any Commission Work for any other purpose without the prior written approval of the Executive Board.

## 2. Attribution and moral rights
The Commission shall credit the Member wherever practicable. The Member retains the moral rights granted by the Intellectual Property Code of the Philippines (Republic Act No. 8293). Upon the official publication of a Commission Work, the Member may include it in the Member’s personal portfolio, with due credit to the Commission.

## 3. Names and marks
The name, seal and logos of the Commission, and the name and marks of the University, shall be used only for official purposes and only in the forms the Commission approves.

## 4. Works of third parties
The Member shall not incorporate any copyrighted work of another, including images, music, fonts and software, into a Commission Work without permission or a valid licence, and shall properly cite all sources.

## 5. Pre-existing works
Works the Member created before joining the Commission, or outside the Member’s duties, remain the Member’s property. Where the Member incorporates any such work into a Commission Work, the Member grants the Commission a non-exclusive, perpetual and royalty-free licence to use it therein.`,
  },

  "terms-of-service": {
    title: "Terms of Service",
    statement: "I have read and understood the Terms of Service, and I agree to be bound by them.",
    body: `These Terms of Service (“the Terms”) govern the use of the Commission Portal (“the Portal”), the private workspace of the Commission, and of the tools within it.

## 1. Accounts
1. Each account is tied to the Member’s UST Google account. The Member shall sign in only with that account, and shall not share or lend it or permit any other person to use the Member’s session.
2. Access is determined by the Member’s unit and position. The Member shall not attempt to access any resource beyond the access granted.
3. The Member shall keep the Member’s Google account secure, with a strong password and two-step verification, and shall sign out of shared devices.
4. The Member shall notify the Executive Board immediately upon suspecting any unauthorized use of the Member’s account.

## 2. Termination of access
Access shall terminate upon the end of the Member’s term, on the expiry date the Executive Board sets, or upon revocation. The Commission may suspend access at any time to protect the Portal or the integrity of an investigation.

## 3. Content
The Member is responsible for all content the Member posts, uploads or modifies in the Portal. Content added for the Commission constitutes a Commission Work under the Intellectual Property Agreement.

## 4. Audit records
The Portal records sign-ins and changes, together with the identity of the person who made them and the time they were made, to ensure the accountability of the Commission. The Executive Board may review these records, and they may be used as evidence in any investigation.

## 5. Availability
The Portal is provided on an “as is” basis. The Commission endeavours to keep it available and accurate, but makes no warranty that it will be uninterrupted or free of errors.

## 6. Amendments
The Commission may amend these Terms. Material amendments shall be announced in the Portal, and continued use of the Portal after they take effect shall constitute acceptance of them.

## 7. Governing rules
These Terms shall be read together with the Constitution, the Elections Code, the policies of the University, and the laws of the Republic of the Philippines.`,
  },

  "acceptable-use": {
    title: "Acceptable Use Policy",
    statement: "I have read and understood the Acceptable Use Policy, and I agree to comply with it.",
    body: `This Policy sets forth the permitted and prohibited uses of the Commission Portal, its email tools and its files.

## 1. Permitted use
The Member may:
- use the Portal for Commission work within the scope of the Member’s role;
- send official communications through the Portal’s tools, in the name of the Commission, where the Member’s role so permits; and
- download records where a task requires them, and shall delete them upon its completion.

## 2. Prohibited use
The Member shall not:
1. use the Portal for personal, commercial, partisan or campaign purposes;
2. access, or attempt to access, any record, tab or account beyond the Member’s authorized access, including by sharing sessions or guessing links;
3. copy, export or share the personal data of students, applicants or candidates, except as a task requires;
4. send unsolicited or chain messages, or any message in the name of the Commission without authority;
5. upload any unlawful, obscene, defamatory, discriminatory or infringing material, or any malicious software;
6. probe, scan, overload or interfere with the security or operation of the Portal, or circumvent its limits;
7. use automated tools to read or modify data, unless the Executive Board permits it;
8. alter, delete or backdate any record to mislead any person; or
9. impersonate any other Member or the Commission.

## 3. Duty to report
The Member shall report any security vulnerability or misuse to the Executive Board immediately, and shall not test it further.

## 4. Sanctions
For any breach of this Policy, the Commission may suspend or revoke access, remove content and impose disciplinary action, and may refer serious breaches to the University or the proper authorities.`,
  },

  "privacy-policy": {
    title: "Privacy Policy",
    statement: "I have read and understood the Privacy Policy, and I agree to comply with it.",
    body: `This Policy governs the handling of personal data in the Commission Portal, both the Member’s own and that of the students, applicants and candidates with whom the Member works. It shall be read together with the Data Privacy Notice to which the Member consented.

## 1. The Member’s personal data
The Portal keeps the Member’s profile, access, onboarding declarations and the times of their acceptance, and records of the Member’s activity. These are processed as the Data Privacy Notice provides.

## 2. Personal data handled by the Member
In handling the personal data of others, the Member shall:
1. collect only what a task requires, and use it solely for that task;
2. keep it within the Portal and the official tools of the Commission;
3. retain no personal copies, and delete working files upon the completion of a task;
4. share it only with Members who require it for their duties; and
5. report any personal data breach to the Executive Board within twenty-four (24) hours.

## 3. Cookies and sessions
The Portal uses only essential cookies, to keep the Member signed in and secure. A session closes after thirty (30) minutes of inactivity, and ends after eight (8) hours. The Portal uses no advertising cookies.

## 4. Storage and security
Personal data are stored with the Commission’s hosting and storage providers and are encrypted in transit. Access is limited by unit and position, and all changes are logged.

## 5. Retention
Applications and requests for access are deleted sixty (60) days after their submission. Accounts and declarations are retained as the Data Privacy Notice provides.

## 6. Inquiries
Questions, requests and complaints concerning privacy shall be addressed to comelec@ust.edu.ph.`,
  },

  "officer-acceptance": {
    title: "Officer Acceptance and Turnover Agreement",
    statement: "I accept my office, and I agree to be bound by the Officer Acceptance and Turnover Agreement.",
    body: `## 1. Acceptance of office
I hereby accept the position and role stated in my profile. I shall faithfully discharge its duties for the whole of my term, in accordance with the Constitution, the Elections Code and the rules of the Commission. I assume this office freely, without mental reservation or purpose of evasion.

## 2. Receipt of turnover
Upon assuming office, I shall:
1. receive the turnover of my office, including its files, accounts, pending matters and property, from my predecessor or the Executive Board;
2. verify what I receive against the turnover inventory, and report any deficiency within seven (7) days; and
3. be accountable for everything I receive from that time forward.

## 3. Turnover upon leaving office
Upon the end of my term, or upon my resignation or removal, I shall:
1. prepare a turnover report for my office, covering pending matters, deadlines, contacts and lessons learned;
2. surrender every document, file, account and item of Commission property in my custody within fifteen (15) days;
3. transfer the ownership of the shared drives, pages, forms and files I created for the Commission to the Commission’s official account;
4. delete all personal copies of Commission records in my possession; and
5. respond, within reason, to the inquiries of my successor for thirty (30) days after turnover.

## 4. Clearance
I understand that the Commission may withhold my certificate of service, or any clearance it issues, until my turnover is complete.

## 5. Continuing accountability
I shall remain accountable for my acts in office after the end of my term, including under the Confidentiality Agreement.`,
  },
};

/** A document as version 1, before anyone edits it. */
export const defaultDocument = (key: DefaultOnboardingDocumentKey): OnboardingDocument => ({ key, ...defaultDocuments[key], version: 1, savedAt: null, savedBy: null });

export type TextBlock = { kind: "heading"; text: string } | { kind: "paragraph"; text: string } | { kind: "bullets"; items: string[] } | { kind: "numbers"; items: string[] };

/** Splits a text into headings, paragraphs and lists, for the reader and the preview. */
export function parseText(body: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    const number = /^\d+[.)]\s+(.*)$/.exec(line);
    if (!line) flush();
    else if (line.startsWith("## ")) {
      flush();
      blocks.push({ kind: "heading", text: line.slice(3).trim() });
    } else if (bullet || number) {
      flush();
      const kind = bullet ? "bullets" : "numbers";
      const item = (bullet ?? number)![1]!;
      const last = blocks.at(-1);
      if (last && (last.kind === "bullets" || last.kind === "numbers") && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}

const formatter = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

/** "Oct 11, 2026, 3:42 PM", Philippine time. */
export const formatAccepted = (iso: string) => formatter.format(new Date(iso));

/** The declarations kept on a request or account, as far as they can be read. */
export function readDeclarations(value: unknown): Declaration[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const { key, title, version, acceptedAt } = item as Record<string, unknown>;
    if (!isOnboardingDocumentKey(key) || typeof acceptedAt !== "string" || Number.isNaN(Date.parse(acceptedAt))) return [];
    return [{ key, title: typeof title === "string" && title ? title : defaultDocuments[key as DefaultOnboardingDocumentKey]?.title ?? "Onboarding document", version: typeof version === "number" ? version : 1, acceptedAt }];
  });
}

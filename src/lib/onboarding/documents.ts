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

export type OnboardingDocumentKey = (typeof onboardingDocumentKeys)[number];

export const isOnboardingDocumentKey = (value: unknown): value is OnboardingDocumentKey => typeof value === "string" && (onboardingDocumentKeys as readonly string[]).includes(value);

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

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];

/** "Step 3", as the editor and the form name a document's place. */
export const stepOf = (key: OnboardingDocumentKey) => onboardingSteps.findIndex((step) => step.id === key);

export const defaultDocuments: Record<OnboardingDocumentKey, OnboardingText> = {
  "privacy-notice": {
    title: "Data Privacy Notice and Consent Form",
    statement: "I have read this notice, and I freely consent to the UST Central Comelec collecting and processing my personal data as it describes.",
    body: `The UST Central Commission on Elections (“the Commission”) respects your privacy. This notice explains what personal data we collect when you request access to the Commission Portal and complete onboarding, why we collect it, who sees it, and how we protect it. It follows Republic Act No. 10173, the Data Privacy Act of 2012, its Implementing Rules and Regulations, and the University of Santo Tomas’s data privacy policies.

## What we collect
- Your name, student number, UST email address, mobile number and Facebook profile link
- Your college or faculty, program and year level
- Your unit, position and role in the Commission
- If you were recruited: the details of your accepted application
- Your acceptance of each onboarding document, with the date and time you accepted it
- Records of your activity in the Commission Portal, such as sign-ins and the changes you make

## Why we collect it
- To verify that you are a bona fide Thomasian student and a member of the Commission
- To create and manage your Commission Portal account, and to decide what it can open
- To list you in the Commission’s Directory and, where your role calls for it, in “Meet the commission” on the website
- To contact you about your duties, meetings and other Commission matters
- To keep a record of your undertakings and declarations, as the Constitution, the Elections Code and University rules require
- To keep the portal secure, and to investigate misuse

## Who sees it
Your details are seen by the Commission’s Executive Board and by the officers who manage accounts for your unit. Your name, role, unit, UST email, Facebook link and photo appear in the Directory for other members. Your name, role and photo may appear on the public website.

We don’t sell your data, and we don’t share it outside the University except where the law requires it or you consent. Service providers that host the portal and its files process data on the Commission’s behalf, under appropriate safeguards.

## How long we keep it
- A request for access is deleted 60 days after it’s sent.
- Your account and your declarations are kept while you serve, and for up to one (1) academic year after your term ends, for turnover and accountability. They are then deleted or anonymized, unless the law or a pending case requires us to keep them longer.

## How we protect it
Only verified UST Google accounts can sign in, every connection is encrypted, and each member sees only what their position needs. Members who handle personal data are bound by the Confidentiality Agreement.

## Your rights
Under the Data Privacy Act you have the right to be informed, to access your data, to object to its processing, to have it corrected, to have it erased or blocked, to data portability, to be indemnified for damages, and to file a complaint with the National Privacy Commission. To use any of these rights, write to comelec@ust.edu.ph. You may also reach the University’s Data Protection Officer.

## Your consent
By ticking the box below, you confirm that you have read this notice, that the information you give is true, and that you freely consent to the Commission processing your personal data for the purposes above. You may withdraw your consent at any time by writing to us. Withdrawing ends your portal access, since the portal can’t work without it.`,
  },

  "membership-agreement": {
    title: "Membership Agreement",
    statement: "I have read and agree to the Membership Agreement.",
    body: `This Membership Agreement is between you (“the Member”) and the UST Central Commission on Elections (“the Commission”). It takes effect when you submit your onboarding.

## 1. Membership
1. You are admitted as a member of the Commission in the unit, position and role shown in your profile. Your unit is the Central Comelec or your college’s Local Comelec.
2. Membership is personal. It can’t be passed to anyone else, and your portal account is for your use only.
3. Your term runs for the current academic year, or until you resign or are removed, whichever comes first.

## 2. Eligibility
You confirm that:
- you are a bona fide student of the University of Santo Tomas, currently enrolled;
- you are in good academic and disciplinary standing;
- you meet the qualifications the Constitution and the Elections Code set for your position; and
- the information in your profile is true and complete.

You will tell the Executive Board straight away if any of these stops being true.

## 3. Duties
As a Member you will:
- uphold the Constitution, the Elections Code, and the Commission’s resolutions and rules;
- carry out the tasks your office assigns, on time and to standard;
- attend the meetings, trainings and election duties you’re called to, or give notice beforehand if you can’t;
- keep your profile up to date; and
- respect the University’s rules, the Code of Conduct, and your fellow Members.

## 4. Acting for the Commission
The Commission decides as a body, under the authority the Constitution gives it. No Member may speak or act for the Commission, or commit it to anything, without that authority.

## 5. Resignation and removal
1. You may resign by writing to your unit’s Chairperson, with at least fifteen (15) days’ notice where you can, and you will complete turnover before you leave.
2. You may be suspended or removed for breaching this Agreement or any onboarding document, under the process the Constitution, the Elections Code and the Commission’s rules set. You will be heard before any decision is made.
3. When your membership ends, your portal access ends with it.

## 6. Voluntary service
Membership is voluntary service. You aren’t an employee of the Commission or the University, and you aren’t paid for your service.

## 7. The whole agreement
This Agreement, with the other onboarding documents you accept, sets out your commitments as a Member. Where any of them conflicts with the Constitution or the Elections Code, those prevail.`,
  },

  "code-of-conduct": {
    title: "Code of Conduct and Nonpartisanship Agreement",
    statement: "I have read and agree to the Code of Conduct and Nonpartisanship Agreement.",
    body: `The Commission’s authority rests on the trust of the Thomasian electorate. This Code sets the conduct expected of every Member, in and out of election season.

## 1. Integrity
- Act honestly. Never falsify, hide or alter records, results or documents.
- Never accept gifts, favours, food, money or anything of value from a candidate, a political party, or anyone acting for them.
- Report any attempt to influence you or another Member.

## 2. Professional conduct
- Treat students, candidates, parties, fellow Members and University personnel with courtesy and respect, without discrimination or harassment.
- Be punctual, prepared and responsive.
- Use the Commission’s name, logo and channels only for official purposes, and only with authority.

## 3. Nonpartisanship
For as long as you are a Member, you will not:
1. join, run under, or hold office in any student political party or coalition;
2. run for any elective student position;
3. campaign for or against any candidate, party or position, in person or online, including through likes, shares, reactions, comments, profile frames or endorsements;
4. help prepare any candidate’s or party’s campaign, filing or materials;
5. reveal non-public information about an election to anyone outside the Commission; or
6. give a public opinion on a candidate, a party, or a pending case.

You will leave any party you belong to before you take office, and say so in your Declaration of Neutrality and Impartiality.

## 4. Social media
Your personal accounts are your own, but what you post reflects on the Commission. On election matters, share only the Commission’s official announcements, without comment.

## 5. Breaches
A breach of this Code may lead to a warning, suspension or removal, and to referral to the University where its rules apply.`,
  },

  confidentiality: {
    title: "Confidentiality Agreement",
    statement: "I have read and agree to the Confidentiality Agreement.",
    body: `In your work you will see information that isn’t public: personal data of students, applicants and candidates; case records; deliberations; draft resolutions; election materials; and what’s in the Commission Portal (together, “Confidential Information”).

## 1. What you agree to
1. Use Confidential Information only to carry out your duties.
2. Don’t disclose it to anyone outside the Commission, or to a Member who doesn’t need it for their duties, unless the Executive Board authorizes it or the law requires it.
3. Don’t copy, download, screenshot or forward it, or take it outside the Commission’s official tools, except as your duties require.
4. Keep the deliberations of the Commission, the En Banc and every chamber confidential, including how each Member voted.
5. Handle personal data as the Data Privacy Act requires, and report any loss, leak or unauthorized access to the Executive Board within twenty-four (24) hours of learning of it.

## 2. What isn’t covered
Information that is already public through no fault of yours, and information you’re required to disclose by law or by a lawful order. In that case, tell the Commission first wherever you can.

## 3. How long it lasts
This duty starts when you submit your onboarding, and it continues after your membership ends.

## 4. Returning materials
When your membership ends, you will hand over every document, file and account in your keeping, and delete any copies you hold, as part of turnover.

## 5. Breaches
A breach may lead to removal, referral to the University, and liability under the Data Privacy Act and other laws.`,
  },

  neutrality: {
    title: "Declaration of Neutrality and Impartiality",
    statement: "I make this Declaration of Neutrality and Impartiality, and I confirm that it is true.",
    body: `I, the Member named in this onboarding, declare that:

1. I am not a member, officer, candidate or volunteer of any student political party or coalition, and I will not become one while I serve.
2. I am not a candidate for any elective student position, and I will not file a candidacy while I serve.
3. I have no relationship with any candidate or party officer that would keep me from acting fairly. Where I have one, I have disclosed it, or will disclose it, to the Executive Board under the Recusal Undertaking.
4. I will decide every matter on its merits, on the evidence and the rules alone, without fear or favour, and without regard to who the candidate or party is.
5. I will apply the Constitution and the Elections Code equally to every candidate, party and voter.
6. I will not let any personal interest, friendship, organization or loyalty affect my work in the Commission.
7. I understand that if this declaration is false, or stops being true and I don’t report it, I may be removed from the Commission.

I make this declaration freely, and I confirm it by accepting it electronically.`,
  },

  recusal: {
    title: "Recusal Undertaking",
    statement: "I have read and agree to the Recusal Undertaking.",
    body: `A Member must step aside from any matter where their impartiality could reasonably be questioned. This undertaking sets out when, and how.

## 1. When I will recuse
I will take no part in a matter, including its discussion, investigation, deliberation, vote or implementation, if:
- I am related within the fourth (4th) civil degree of consanguinity or affinity to a candidate, party officer, petitioner or respondent involved;
- I am, or was in the past twelve (12) months, a member, officer or volunteer of a party involved;
- I have a close personal, romantic, business or organizational relationship with someone involved;
- I have already given a public opinion on the matter; or
- anything else would lead a fair-minded observer to doubt my impartiality.

## 2. How I will recuse
1. I will disclose the conflict in writing to my unit’s Chairperson as soon as I learn of it, and before the matter is taken up. If the conflict involves the Chairperson, I will tell the Vice Chairperson.
2. I will leave any meeting while the matter is discussed and decided, and I won’t try to influence anyone who decides it.
3. I will not open the records of the matter, in the portal or anywhere else.
4. My recusal, and its reason, will be recorded in the minutes.

## 3. When others ask
If anyone asks for my recusal, I will let the Executive Board decide, and I will abide by its decision.

## 4. Failing to recuse
I understand that failing to disclose a conflict, or to recuse, may void my part in the matter, and may lead to my removal.`,
  },

  "intellectual-property": {
    title: "Intellectual Property",
    statement: "I have read and agree to the Intellectual Property terms.",
    body: `## 1. Work you create for the Commission
Everything you create in the course of your duties, including resolutions, memoranda, reports, designs, publication materials, photos, videos, code, forms and templates (“Commission Works”), is created for the Commission. You agree that:
1. the Commission may use, reproduce, adapt, publish and distribute Commission Works, without time limit and without payment to you;
2. to the extent you hold copyright in a Commission Work, you assign it to the Commission or, where that isn’t possible, grant the Commission an exclusive, perpetual, royalty-free licence to it; and
3. you will not publish, sell or reuse Commission Works for any other purpose without the Executive Board’s written approval.

## 2. Credit
The Commission will credit you where it’s practical. You keep your moral rights under the Intellectual Property Code of the Philippines (Republic Act No. 8293). Once a Commission Work is officially published, you may show it in your personal portfolio, with credit to the Commission.

## 3. Names and marks
The Commission’s name, seal and logos, and the University’s name and marks, may be used only for official purposes, in the forms the Commission approves.

## 4. Other people’s work
You will not use anyone else’s copyrighted work, including images, music, fonts and software, in a Commission Work without permission or a valid licence, and you will credit your sources.

## 5. Your own materials
Anything you made before joining, or outside your duties, stays yours. If you bring it into a Commission Work, you grant the Commission a non-exclusive, perpetual, royalty-free licence to use it there.`,
  },

  "terms-of-service": {
    title: "Terms of Service",
    statement: "I have read and agree to the Terms of Service.",
    body: `These Terms govern your use of the Commission Portal (“the Portal”), the Commission’s private workspace, and the tools inside it.

## 1. Your account
1. Your account is tied to your UST Google account. You sign in only with that account, and you may not share it, lend it, or let anyone else use your session.
2. What you can open follows your unit and position. Don’t try to reach anything your access doesn’t give you.
3. Keep your Google account secure, with a strong password and two-step verification, and sign out on shared devices.
4. Tell the Executive Board at once if you think someone else has used your account.

## 2. When access ends
Your access ends when your term ends, on the expiry date the Executive Board sets, or when it’s revoked. The Commission may suspend access at any time to protect the Portal or an investigation.

## 3. Your content
You are responsible for what you post, upload or change in the Portal. What you add for the Commission is a Commission Work, under the Intellectual Property terms.

## 4. Records
The Portal records sign-ins and changes, with who made them and when, to keep the Commission accountable. The Executive Board may review these records, and they may be used in an investigation.

## 5. Availability
The Portal is provided as it is. The Commission works to keep it available and accurate, but can’t promise it will always be available or free of errors.

## 6. Changes to these Terms
The Commission may update these Terms. Significant changes will be announced in the Portal, and using the Portal after they take effect means you accept them.

## 7. Governing rules
These Terms are read together with the Constitution, the Elections Code, the University’s policies, and the laws of the Philippines.`,
  },

  "acceptable-use": {
    title: "Acceptable Use Policy",
    statement: "I have read and agree to the Acceptable Use Policy.",
    body: `This policy sets out what you may and may not do with the Commission Portal, its email tools and its files.

## You may
- use the Portal for Commission work within your role;
- send official messages through the Portal’s tools, in the Commission’s name, where your role allows; and
- download records when a task needs them, and delete them once it’s done.

## You may not
1. use the Portal for personal, commercial, partisan or campaign purposes;
2. open, or try to open, records, tabs or accounts beyond your access, including by sharing sessions or guessing links;
3. copy, export or share the personal data of students, applicants or candidates, except as a task needs;
4. send spam, chain messages, or messages in the Commission’s name without authority;
5. upload unlawful, obscene, defamatory, discriminatory or infringing material, or malware;
6. probe, scan, overload or interfere with the Portal’s security or operation, or get around its limits;
7. use automated tools to read or change data, unless the Executive Board allows it;
8. alter, delete or backdate records to mislead anyone; or
9. impersonate another Member or the Commission.

## Reporting problems
If you find a security problem or see misuse, report it to the Executive Board at once, and don’t test it further.

## Breaches
For any breach, the Commission may suspend or revoke access, remove content and take disciplinary action, and refer serious breaches to the University or the authorities.`,
  },

  "privacy-policy": {
    title: "Privacy Policy",
    statement: "I have read and agree to the Privacy Policy.",
    body: `This policy explains how the Commission Portal handles personal data: your own, and that of the students, applicants and candidates you work with. Read it with the Data Privacy Notice you consented to at the start.

## 1. Your data
The Portal keeps your profile, your access, your onboarding declarations and when you accepted them, and records of your activity. It uses them as the Data Privacy Notice describes.

## 2. Data you handle
As a Member you will handle other people’s personal data. You will:
1. collect only what a task needs, and use it only for that task;
2. keep it inside the Portal and the Commission’s official tools;
3. keep no personal copies, and delete working files once a task is done;
4. share it only with Members who need it for their duties; and
5. report any personal data breach to the Executive Board within twenty-four (24) hours.

## 3. Cookies and sessions
The Portal uses only essential cookies, to keep you signed in and secure. A session closes after 30 minutes of inactivity, and ends after 8 hours. The Portal uses no advertising cookies.

## 4. Storage and security
Data is kept with the Commission’s hosting and storage providers and encrypted in transit. Access is limited by unit and position, and changes are logged.

## 5. Retention
Applications and access requests are deleted 60 days after they’re sent. Accounts and declarations are kept as the Data Privacy Notice says.

## 6. Contact
Send questions, requests and complaints about privacy to comelec@ust.edu.ph.`,
  },

  "officer-acceptance": {
    title: "Officer Acceptance and Turnover Agreement",
    statement: "I accept my office, and I agree to the Officer Acceptance and Turnover Agreement.",
    body: `## 1. Acceptance of office
I accept the position and role shown in my profile. I will perform its duties faithfully for my whole term, under the Constitution, the Elections Code and the Commission’s rules. I take this office freely, without mental reservation or purpose of evasion.

## 2. Receiving turnover
When I take office, I will:
1. receive the turnover of my office from my predecessor or the Executive Board: its files, accounts, pending matters and property;
2. check what I receive against the turnover inventory, and report anything missing within seven (7) days; and
3. take responsibility for everything I receive from then on.

## 3. Handing over
When my term ends, or if I resign or am removed, I will:
1. prepare a turnover report for my office, covering pending matters, deadlines, contacts and lessons learned;
2. hand over every document, file, account and item of Commission property in my keeping within fifteen (15) days;
3. transfer ownership of the shared drives, pages, forms and files I created for the Commission to the Commission’s official account;
4. delete my personal copies of Commission records; and
5. within reason, answer my successor’s questions for thirty (30) days after turnover.

## 4. Clearance
I understand that the Commission may withhold my certificate of service, or any clearance it issues, until my turnover is complete.

## 5. Accountability
I remain answerable for what I did in office after my term ends, including under the Confidentiality Agreement.`,
  },
};

/** A document as version 1, before anyone edits it. */
export const defaultDocument = (key: OnboardingDocumentKey): OnboardingDocument => ({ key, ...defaultDocuments[key], version: 1, savedAt: null, savedBy: null });

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
    return [{ key, title: typeof title === "string" && title ? title : defaultDocuments[key].title, version: typeof version === "number" ? version : 1, acceptedAt }];
  });
}

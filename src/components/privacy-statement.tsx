import Link from "next/link";
import { APPLICATION_RETENTION_DAYS } from "@/lib/applications/options";

export const PRIVACY_UPDATED = "2026-10-06";
export const PRIVACY_CONTACT = "comelec@ust.edu.ph";
export const privacySections = [
  { id: "scope", label: "Who this covers" },
  { id: "collection", label: "Information we collect" },
  { id: "purposes", label: "How we use it" },
  { id: "access", label: "Access and disclosure" },
  { id: "services", label: "Service providers" },
  { id: "retention", label: "Retention" },
  { id: "security", label: "Security and cookies" },
  { id: "rights", label: "Your rights" },
  { id: "contact", label: "Contact and updates" },
] as const;

/** One statement for the public website and the authenticated portal. */
export function PrivacyStatement({ portal = false }: { portal?: boolean }) {
  const contents = [
    <>
      <p>The UST Central Commission on Elections (Central Comelec) operates this website and its Commission Portal. This statement explains how information is handled when you browse public pages, submit a form, verify an account, or use the portal. Local Comelec units handle matters assigned to their own units through the same system.</p>
      <p>Form-specific collection notices explain the information needed for a particular application or event. Read those notices together with this statement. External voting systems and linked websites have their own privacy notices.</p>
    </>,
    <>
      <p><strong>Browsing and security.</strong> The server receives request information, including your IP address, to serve pages and limit abusive requests. Your browser can also store session and display preferences.</p>
      <p><strong>Recruitment and access requests.</strong> Depending on the form, we collect names, UST email addresses, student numbers, college, program, year level, contact details, requested roles, interview choices and review results. Recruitment also collects qualifications, conflict declarations, Facebook profile links and links to supporting documents, such as a résumé, registration form, letter of intent or grades.</p>
      <p><strong>Events.</strong> Registration may collect your name, email, age, sex, student or staff affiliation, organization and attendance details. If you request logistics support, it may collect vehicle details, dietary requirements or allergens. Attendance and evaluation records may include your responses and feedback.</p>
      <p><strong>Party registration.</strong> Submissions may contain party and contact details, officer and member rosters, student information, alumni and affiliate details, declarations, witness details and supporting documents. If you submit another person’s information, ensure you are authorized to do so and inform them of this statement.</p>
      <p><strong>Portal accounts and communications.</strong> We keep account details, unit memberships, roles, access permissions, verification and account-status information. Communications records include message content, sender and recipient details, delivery options, schedules, delivery results, announcements, notifications and per-account read timestamps.</p>
      <p><strong>Google verification.</strong> When you sign in, Google supplies account information used by the sign-in service, including your name and email. The portal may display your Google profile photo. We do not receive your Google password.</p>
    </>,
    <>
      <p>Information is used to verify identity and eligibility; process applications and access requests; arrange interviews; review party registrations; manage event registration, attendance and feedback; maintain commission accounts and the public directory; send announcements and service messages; and protect the system from misuse.</p>
      <p>Forms that require consent ask for it before submission. Providing required information enables the requested service; omitting it may prevent processing. Optional details are identified on the relevant form.</p>
      <p>Processing must have an applicable lawful basis. Consent-based processing follows the permission requested on the form; other processing may rely on a legal obligation or a legitimate interest, where permitted and subject to your rights. Sensitive information, including education, health or political-affiliation details, requires the additional protections applicable to it.</p>
      <p>Reading this statement or browsing the website does not by itself give consent to every use of your information.</p>
    </>,
    <>
      <p>Portal access depends on an account’s role and granted permissions. Local accounts are restricted to their own college’s records where the portal applies unit boundaries. Authorized Central accounts may access records across units according to their permissions. Shared official accounts act for the unit they represent.</p>
      <p>Inbox messages are available to the account memberships selected as recipients. Officials authorized to use the Email Sender can review its Outbox within their permitted scope. Notification audiences follow the relevant account or unit activity. Email and portal inbox delivery may be selected separately.</p>
      <p>The public About page displays the names, roles, college affiliations and available photos of listed commission members and advisers. Public news, official documents and event pages can also identify people involved in published commission activities. Application records, student numbers and private inbox messages are not displayed in the public directory.</p>
      <p>Information may be handled by the officers reviewing the relevant matter and by service providers needed to operate the system. Disclosure may also be required by law or an authorized process. The website does not provide an advertising marketplace or a feature for selling personal information.</p>
    </>,
    <>
      <p><strong>Supabase</strong> provides authentication, database services and storage used by the app. <strong>Google</strong> provides account verification; Google Drive is used for linked supporting documents and commission document uploads. <strong>Google’s mail service</strong> sends configured email notifications and messages. Website hosting and network services process requests needed to deliver the site.</p>
      <p>These providers may process information outside the Philippines according to their infrastructure and applicable arrangements. This statement does not promise a particular storage country. Following a link to Google Drive, Facebook, an external voting system or another website brings you under that service’s own privacy practices.</p>
      <p>Supporting files remain subject to their owner’s sharing settings. A file shared with anyone who has its link may be accessible beyond the commission; limit access where the relevant submission instructions allow it.</p>
    </>,
    <>
      <p><strong>Recruitment applications and portal access requests:</strong> the app applies a {APPLICATION_RETENTION_DAYS}-day retention period from submission. Records beyond that period are excluded from normal application and request views and are scheduled for database deletion.</p>
      <p><strong>Other records:</strong> event records, party registrations, portal accounts, messages, delivery history and read receipts do not currently have a fixed automatic deletion period in the app. Ask the commission about retention for your particular record or request deletion using the contact below.</p>
      <p>Account expiry or signing out does not automatically erase every related record. Removing an application or a document link does not delete a file in your own Google Drive, a delivered email, or a recipient’s downloaded copy. Those copies have separate retention and deletion arrangements.</p>
      <p>Retention and deletion requests are subject to any applicable requirement to preserve a record. If a record must be kept, the reason and applicable retention period should be explained in responding to your request.</p>
    </>,
    <>
      <p>The portal checks sign-in, active account membership and permissions on the server. It uses signed verification passes, session timeouts and request limits. Portal sessions end after 30 minutes of inactivity or eight hours in total. Access to private records still depends on authorized users protecting their accounts and handling downloads responsibly.</p>
      <p>Cookies and browser storage support authentication, form verification, account selection, theme and sidebar preferences, and session activity. Read the <Link href="/cookies" prefetch={portal ? false : undefined}>cookie policy</Link> for details and browser controls. Clearing cookies can sign you out; it does not delete submitted records.</p>
      <p>The website does not include advertising or behavioral analytics trackers. No security measure can eliminate every risk. If you suspect unauthorized access or an inappropriate disclosure, contact the commission promptly and include enough information to identify the concern.</p>
    </>,
    <>
      <p>Under the <a href="https://privacy.gov.ph/data-privacy-act/" target="_blank" rel="noreferrer">Data Privacy Act of 2012 (Republic Act No. 10173)</a>, you may exercise applicable rights to be informed, access and correct your information, object to processing, request erasure or blocking, and obtain a portable copy where the conditions apply. You may withdraw consent for processing that relies on it and raise a complaint with the <a href="https://privacy.gov.ph/" target="_blank" rel="noreferrer">National Privacy Commission</a>. Rights are subject to the law’s conditions and exceptions.</p>
      <p>Write to <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a> with your name, the service or record involved, and what you want us to do. We may need to verify your identity or authority before releasing or changing a record. Do not send your password or unnecessary identity documents in your initial message.</p>
      <p>Withdrawing consent may affect a service that needs the information. It does not automatically remove processing completed before withdrawal or records that must be retained on another lawful basis.</p>
    </>,
    <>
      <p>For questions, privacy requests or concerns about the website or portal, contact the UST Central Commission on Elections at <a href={`mailto:${PRIVACY_CONTACT}`}>{PRIVACY_CONTACT}</a>, or visit Room 4F, UST Tan Yan Kee Student Center, University of Santo Tomas, España Boulevard, Sampaloc, Manila, Philippines.</p>
      <p>This statement will be updated when the website’s or portal’s information practices change. The date above identifies this version. Where a new purpose requires fresh consent, an updated statement alone does not replace that consent.</p>
    </>,
  ];

  return <div className={portal ? "portal-privacy-content" : "ck-body"}>
    {privacySections.map((section, index) => <section key={section.id} id={section.id} className={portal ? "portal-card portal-privacy-section" : "ck-section"} aria-labelledby={`privacy-${section.id}-title`}>
      <p className={portal ? "portal-eyebrow" : "ck-serial"}>{String(index + 1).padStart(2, "0")}</p>
      <h2 id={`privacy-${section.id}-title`}>{section.label}</h2>
      {contents[index]}
    </section>)}
  </div>;
}

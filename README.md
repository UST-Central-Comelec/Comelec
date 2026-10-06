This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Commission Portal

Commissioners manage the website's news, documents (executive orders, memorandums, resolutions, constitution, elections code, proclamations) and events at **`/portal`**. Nothing on the public site links to it; share the URL with commissioners directly.

- **Sign-in:** "Sign in with Google", limited to `@ust.edu.ph` accounts added under **Accounts**. Any other Google account is turned away.
- **Accounts:** two categories. A **personal account** is a person's own, and holds their name (kept in capitals), UST email, student ID, affiliation (Central Comelec, Local Comelec or Office for Student Affairs), position (Executive Board, Executive Associate, Deputy, Adviser or Admin), role ("Chairperson", "Office of the Chairperson", "Deputy"), college, program and Facebook link. Advisers and Admins have no role, program or student ID, and the Office for Student Affairs' accounts are Admins, with no college either. An **official account** is a unit's shared mailbox (`comelec.sci@ust.edu.ph`), with only its email and unit. An account approved from **Request access** has its email verified already; one added by hand is verified the first time it signs in. Revoking takes effect on the next click.
- **Access:** an account's category, affiliation and position decide which tabs it opens. By default the Executive Board opens everything, Executive Associates everything but the Administrative tab, and Deputies Recruitment, Political Party and Filing of Candidacy. An official account opens what its unit's Executive Board does. Advisers and Admins open everything but only read it: every form is switched off for them, and the server refuses their changes. The Central Executive Board can change what each level opens under **Accounts → Access Control**. A Local account only sees its own college's records, and can't be given the commission-wide tabs; of the apps, Local commissioners get Secretariat, Calendar and Tickets, and a Local unit's official account the Email Sender as well. The rules are in `src/lib/portal/access.ts`.
- **Directory:** filled in from Accounts, never by hand. Every commissioner with an active account and a role is listed, in order of rank, in the portal's Directory and in "Meet the commission" on the About page.
- **Built-in executive:** `PORTAL_EXECUTIVE_EMAIL` always has access, to everything, so someone can add the first accounts. It adds its own details under Accounts to be listed in the Directory.
- **Data:** Supabase. Content and accounts are Postgres tables. The schema is in `supabase/migrations/`; run the files in order.
- **Email:** Gmail over SMTP (`SMTP_USER`, `SMTP_PASSWORD`). Every email shares one design, in `src/lib/email/template.ts`.
- **Automatic emails:** the site emails by itself when an access request is received or decided, an application is received or decided, a revision of the Constitution or the Elections Code moves a step, a setting changes, or an account is added, updated, revoked, restored or removed. Apps → Email Sender → **Automatic** lists each one with a switch beside its name, and shows when it goes, who gets it and a preview. Only the Central Executive Board and the Central Comelec's official account change the switches (`src/lib/notifications/switches.ts`, saved in `email_settings`); the notices to a unit about every new application and every new access request are off until switched on. Who in the commission is told follows what the matter concerns (`src/lib/notifications/concern.ts`): a Central matter goes to the Central Comelec's official account and Executive Board only, a Local one to that college's only. Every email leaves from the Central Comelec's mailbox, so one about a Local unit says it came "through the Central Comelec COMET". The emails for party registration, the filing of candidacy and petitions are written (`src/lib/filings/emails.ts`, `src/lib/petitions/`) and wait for those forms.
- **Email Sender:** The portal's Email Sender (Apps → Email Sender) writes to groups of portal accounts and keeps an outbox in `portal_emails`. Scheduled emails go out by themselves on a server that keeps running; on hosting that only runs per request, set `CRON_SECRET` and call `/api/email/dispatch` every minute (see `.env.example`).
- **Documents** link to the commission's Google Drive: share the file as "Anyone with the link" (Viewer) and paste the link. The portal rejects private or broken links.
- **Directory photos** (on each account) upload to the public `uploads` Storage bucket. They're compressed in the browser to 1 MB or less, and the bucket rejects anything larger.
- **News and the Election Explainer:** the **News** tab holds every post. Its category decides the page: press releases, announcements and publications are listed on News (`/news`), and explainers on the Election Explainer (`/explainer`).
- **Statistics:** the **Statistics** tab manages the tables on the website's Statistics page (`/statistics`). A table is pasted from Excel or Google Sheets, headings in the first row, and previewed before it's published. Tables are grouped by the election or period they're filed under, and each can be downloaded as a CSV file.
- **Events:** the **Events** tab manages what the website lists under Events & activities (`/events`). Central accounts manage the Central Comelec's events. Each Local account manages its own college's, and Central accounts can open those and ask the unit for changes (the Central Executive Board can also edit them). Students register, or join the waitlist, after verifying their UST Google account, and are emailed a confirmation with the event's details. An event's page in the portal lists who signed up with their answers, and charts those answers.
- **Constitution and Elections Code:** the **Constitution** and **Elections Code** tabs (under Publications) hold the two texts the website shows at `/constitution` and `/elections-code`. Neither is edited in place. The Central Comelec's Legal Head and Secretary to the Adjudicatory, and the Executive Associates of their offices, write a **revision**: sections and articles added, removed, reordered and reworded. Sent for approval, it's locked and goes to the Chairperson, the Vice Chairperson and the Secretary to the Executive, who each approve it or send it back with what should change. The website shows it once all three have approved; until a first revision is approved it shows the text as it was signed (`src/lib/elections-code/`). The rules are in `src/lib/codes/options.ts`, and revisions are kept in `code_revisions`.
- **Approvals:** **Apps → Approvals** lists the revisions sent for approval, for the three who sign and for the rest of the Central Executive Board to follow. Only the Central Executive Board has this tab; it can't be given to another level under Access Control.
- **Code:** public pages in `src/app/(site)/`, portal in `src/app/(portal)/portal/`, login gate in `src/proxy.ts`, Supabase access in `src/lib/data/` and `src/lib/supabase/`.

### Setting up Supabase and Google sign-in

Inbox and portal notifications require `supabase/migrations/0043_portal_inbox.sql`. Run it in the Supabase SQL Editor before using these features. Official accounts can announce to their unit; Central official accounts and the Central Executive Board can broadcast to all units and commissioners. Announcements and automatic activity notices are recorded going forward, with read status saved separately for each account. Activity notices follow the existing automatic email audiences and are recorded even when email delivery is switched off.

Email Sender delivery options require `supabase/migrations/0044_email_delivery_channels.sql` after 0043. New messages default to both email address and portal inbox; either can be turned off. Scheduled messages keep the selected options, and the Outbox reports delivery for each channel. Existing queued messages keep email-only delivery. Inbox recipients follow the sender's audience and unit restrictions, with every matching membership receiving its own inbox access even when accounts share an email address.

1. **Keys.** Copy `.env.example` to `.env.local`. From Supabase (**Project Settings → API Keys**, and **Data API** for the URL), fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Set `PORTAL_EXECUTIVE_EMAIL` to your `@ust.edu.ph` address.
2. **Database.** In Supabase, open **SQL Editor → New query**, then paste and **Run** each file in `supabase/migrations/`, in order. Run `0033_application_middle_name.sql` before deploying the recruitment form’s full middle-name field; existing applications retain their recorded middle initial. Run `0034_application_registration_form.sql` before deploying the required Latest Registration Form document field. Run `0035_application_email_logs.sql` before deploying recruitment email logs; it records successful acknowledgement and result sends going forward. Run `0039_local_central_division.sql` before deploying unit-specific interview schedules and the Local Central Division. Existing interview slots remain assigned to Central Comelec; Local units add their own schedules and set vacancies for the Executive Assistant to the Central Representative. Run `0040_recruitment_both_venues.sql` before using the “Both” venue option in recruitment settings; venue details can include the physical location and online joining instructions together.
   Run `0036_application_documents.sql` before deploying the recruitment Letter of Intent and Latest Copy of Grades fields. Letter of Intent is required for new applications; existing records remain readable.
   For an existing installation, run `0030_event_registration_references.sql` before using five-character event references. It assigns unique codes to existing registrations and automatically generates them for new registrations. Participants track these codes with their last name at `/apply/track`; applications and portal access requests accept a student number or last name with their existing codes.
   Run `0031_event_evaluation_attendance.sql` to enable per-event evaluation settings, evaluation responses, and attendance timestamps. In an event’s **Evaluation Form** tab, edit the questions and enable responses; its public link is `/events/[id]/evaluate`. Anonymous responses remain unlinked. The **Attendance** tab supports reference codes, student numbers, and complete names, with a full-screen booth mode. New UST registrants can optionally supply their student number.
   Run `0032_party_registrations.sql` to enable **Political Party Registration**. It creates private submission records and a private Storage bucket. Open a unit’s registration period under **PolPaR → Settings** to show the ten-step form at `/party-registration`. Applicants enter the Form 01–05 records and Form 06 applicant/witness details, download filled PDFs for Forms 01–07, then sign and upload their copies and supporting documents before submitting. PDF downloads work before uploads or database submission, after submission on the receipt screen, and from saved applications in the portal. Each applicant gets an individual conforme; long rosters continue onto additional pages. Typed names do not create signatures, and Commission certification fields remain blank. PDF generation runs in the browser using the template logos and licensed embedded fonts in `public/documents/polpar/assets/`. Applicants receive a reference number after submitting. **PolPaR → Applicants** shows the submissions and the editable Commission checklist from Form 07; Local accounts can access only their own unit’s records. Original Word templates are in `public/documents/polpar/`. Uploads accept PDF/JPG/PNG, up to 10 MB each and 30 MB combined; the hosting platform must allow a 32 MB multipart request. Receipt references are used for email follow-ups; public application tracking and approval decisions are not part of this form. Unsubmitted entries stay in the current browser tab only.
3. **Google OAuth client.** In [Google Cloud Console](https://console.cloud.google.com/), under **APIs & Services → Credentials**, create an **OAuth client ID** of type *Web application*. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an **Authorized redirect URI**. On the consent screen, choose **Internal** if the project belongs to the UST Google Workspace; otherwise choose External.
4. **Enable Google in Supabase.** Under **Authentication → Sign In / Providers → Google**, turn it on and paste the client ID and secret.
5. **Redirect URLs.** Under **Authentication → URL Configuration**, set **Site URL** to your site's address. Add `http://localhost:3000/portal/auth/callback` and `https://<your-domain>/portal/auth/callback` to **Redirect URLs**, and the same two addresses ending in `/apply/verify`: applicants and students registering for an event verify their UST account through that one.
6. **Restart.** Restart `npm run dev`, then sign in at `/portal` with the executive email.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

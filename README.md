This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Commission Portal

Commissioners manage the website's news, documents (executive orders, memorandums, resolutions, constitution, elections code, proclamations) and commission members at **`/portal`**. Nothing on the public site links to it; share the URL with commissioners directly.

- **Sign-in:** "Sign in with Google", limited to `@ust.edu.ph` accounts that an executive has added under **Accounts**. Any other Google account is turned away.
- **Roles:** **Commissioners** publish and edit content. **Executives** can do the same, and can add accounts, change roles, and revoke or restore access. Revoking takes effect on the person's next click.
- **Built-in executive:** `PORTAL_EXECUTIVE_EMAIL` always has access, so someone can add the first accounts.
- **Data:** Supabase. Content and accounts are Postgres tables. The schema is in `supabase/migrations/`; run the files in order.
- **Documents** link to the commission's Google Drive: share the file as "Anyone with the link" (Viewer) and paste the link. The portal rejects private or broken links.
- **Member photos** upload to the public `uploads` Storage bucket. They're compressed in the browser to 1 MB or less, and the bucket rejects anything larger.
- **News and the Election Explainer:** the **News** tab holds every post. Its category decides the page: press releases, announcements and publications are listed on News (`/news`), and explainers on the Election Explainer (`/explainer`).
- **Statistics:** the **Statistics** tab manages the tables on the website's Statistics page (`/statistics`). A table is pasted from Excel or Google Sheets, headings in the first row, and previewed before it's published. Tables are grouped by the election or period they're filed under, and each can be downloaded as a CSV file.
- **Events:** the **Events** tab manages what the website lists under Events & activities (`/events`). Central accounts manage the Central Comelec's events. Each Local account manages its own college's, and Central accounts can open those and ask the unit for changes. Students register, or join the waitlist, after verifying their UST Google account, and are emailed a confirmation with the event's details. An event's page in the portal lists who signed up with their answers, and charts those answers.
- **Code:** public pages in `src/app/(site)/`, portal in `src/app/(portal)/portal/`, login gate in `src/proxy.ts`, Supabase access in `src/lib/data/` and `src/lib/supabase/`.

### Setting up Supabase and Google sign-in

1. **Keys.** Copy `.env.example` to `.env.local`. From Supabase (**Project Settings → API Keys**, and **Data API** for the URL), fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Set `PORTAL_EXECUTIVE_EMAIL` to your `@ust.edu.ph` address.
2. **Database.** In Supabase, open **SQL Editor → New query**, then paste and **Run** each file in `supabase/migrations/`, in order.
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

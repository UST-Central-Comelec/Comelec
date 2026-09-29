# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The public site serves four audiences. They are listed in the order the user gave them:

1. **Student organizations and university administration.** Student councils, advisers and university offices who need the commission's official records: executive orders, memorandums, resolutions, the constitution, the elections code and proclamations.
2. **Commissioner applicants.** Thomasian students applying to join the commission through `/apply`. They pick their college, program, year level and preferred body.
3. **Candidates and parties.** People who need the governing documents and the decisions that affect their candidacy.
4. **Student voters.** Thomasians who want announcements, dates and the context they need to take part in an election.

A separate, private audience is **commissioners and executives**. They run the site's content through `/portal`, which nothing on the public site links to.

## Product Purpose

The website of UST Central Comelec, the independent student body that runs central student elections at the University of Santo Tomas. It is the commission's official source of record: its announcements, its documents, who its members are, and how to join. The site succeeds when someone looking for an official commission document or decision can find it, trust that it is authoritative, and cite it.

## Positioning

The site is the commission's own channel, so what it publishes is the commission's word, not commentary about it. It is the only place that holds the full archive of the commission's documents, filterable by type and year, together with the current roster of commission members.

## Operating Context

- **An information hub only.** Voting, candidate filing and vote counting happen on other systems or in person. The site must never look like it offers voting, filing or live tallies.
- **Documents live in the commission's Google Drive.** Each archive entry links to a Drive file shared as "Anyone with the link" (Viewer). The portal rejects private or broken links. Document entries can also carry a body, a reference number and signatories.
- **Content is published through the portal.** Commissioners publish and edit news, documents, members and recruitment settings. Executives can also manage accounts. Sign-in uses Google and is limited to `@ust.edu.ph` accounts that an executive has added.
- **Commission structure.** Members belong to one of three bodies: Central Comelec, En Banc, and Local Comelec.
- **Election cycle.** The 2026 election is the 93rd Central Elections.
- **Contact:** comelec@ust.edu.ph.

## Capabilities and Constraints

- **Public routes:** home, `/news` and `/news/[id]`, `/archive` (filterable by document type and year) and `/archive/[id]`, `/about` (mandate, contact and members grouped by body), and `/apply` (commissioner application).
- **Stack:** Next.js 16 App Router with route groups `(site)` and `(portal)`, Supabase (Postgres plus the `uploads` Storage bucket), Tailwind v4, Base UI, and Motion. The schema lives in `supabase/migrations/`.
- **Member photos** are compressed in the browser to 1 MB or less before upload.
- **Application form options** (colleges and programs) are taken from ust.edu.ph as of September 2026. Year level and preferred body are checked by the database, so the form and the schema have to stay in sync.
- **Undecided:** there is no Filipino or bilingual requirement at present.

## Brand Commitments

- **Logo:** `public/images/Logo-1.png` is the official mark. Use it as supplied, and never redraw or recolor it.
- **UST identity:** the site must visibly belong to the University of Santo Tomas and its Thomasian community.
- **Voice:** formal, neutral and strictly nonpartisan. It speaks as an official commission, never in a campaign register, and never favors or promotes any candidate or party.
- **Stated principles** (in `src/lib/content.ts`): Impartiality, Transparency, Participation.

## Evidence on Hand

- **Assets:** the logo at `public/images/Logo-1.png` and a cover image at `public/images/Cover.png`.
- **Content:** real documents, news and members come from Supabase, and `src/lib/data/seed.ts` holds seed data.
- **Must not be fabricated:** election results, turnout figures, candidate information, testimonials, and any statistic that the commission has not published.

## Product Principles

1. **Official record first.** Every document and announcement should be easy to find, clearly dated and referenced, and citable.
2. **Neutral by construction.** Nothing in the copy, ordering or emphasis may read as favoring a candidate, party or outcome.
3. **Say what the site is not.** Point people to where voting and filing really happen, and never imply the site does them.
4. **Serve institutional readers as well as students.** Student orgs and administrators are the first audience. Clarity and completeness matter more than excitement.
5. **Content is maintained by students who rotate out.** Anything commissioners publish through the portal has to hold up without design intervention.

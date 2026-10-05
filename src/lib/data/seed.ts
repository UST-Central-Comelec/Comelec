import type { ContentDb } from "./types";

// Starting content for a fresh store — the same items the site showed before the portal existed.
// Only used when no content has been saved yet.

const seededAt = "2026-09-29T00:00:00.000Z";
const meta = { createdAt: seededAt, updatedAt: seededAt, updatedBy: "seed" };

export const seedContent: ContentDb = {
  news: [
    {
      id: "2026-central-elections-calendar",
      title: "The 2026 Central Elections calendar is now live",
      category: "announcement",
      date: "2026-09-12",
      excerpt: "Mark your calendars. From accreditation to proclamation, here are the dates every Thomasian voter needs to know.",
      body: "Mark your calendars. From accreditation to proclamation, here are the dates every Thomasian voter needs to know.",
      featured: true,
      ...meta,
    },
    {
      id: "what-makes-a-vote-count",
      title: "What makes a vote count? A guide to the ballot",
      category: "explainer",
      date: "2026-09-08",
      excerpt: "A quick, clear reference for making sure your voice is read exactly as you intend.",
      body: "A quick, clear reference for making sure your voice is read exactly as you intend.",
      featured: false,
      ...meta,
    },
    {
      id: "meet-the-commission-2026",
      title: "Meet the commission behind the 2026 polls",
      category: "announcement",
      date: "2026-08-27",
      excerpt: "Get to know the student leaders and professionals stewarding this year’s election.",
      body: "Get to know the student leaders and professionals stewarding this year’s election.",
      featured: false,
      ...meta,
    },
    {
      id: "students-guide-to-election-day",
      title: "The student’s guide to election day",
      category: "explainer",
      date: "2026-08-19",
      excerpt: "Everything you need to know before you step into the precinct.",
      body: "Everything you need to know before you step into the precinct.",
      featured: false,
      ...meta,
    },
    {
      id: "call-for-applications-electoral-board-2026",
      title: "Call for applications: Electoral Board 2026",
      category: "announcement",
      date: "2026-08-04",
      excerpt: "Applications are open to Thomasians who want to serve the student body.",
      body: "Applications are open to Thomasians who want to serve the student body.",
      featured: false,
      ...meta,
    },
  ],
  documents: [
    {
      id: "2026-official-results",
      kind: "proclamation",
      title: "2026 Central Elections: Official results",
      reference: "",
      date: "2026-05-24",
      summary: "",
      body: "",
      signatories: [],
      fileUrl: null,
      fileName: null,
      ...meta,
    },
  ],
  // The built-in executive comes from PORTAL_EXECUTIVE_EMAIL; everyone else is added in the portal.
  // The Directory is built from these.
  accounts: [],
  // Commissioners add events in the portal.
  events: [],
  statistics: [],
};

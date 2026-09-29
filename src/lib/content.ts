export type NewsItem = {
  category: string;
  date: string;
  title: string;
  excerpt: string;
  accent: string;
  featured?: boolean;
};

export const news: NewsItem[] = [
  {
    category: "Announcement",
    date: "September 12, 2026",
    title: "The 2026 Central Elections calendar is now live",
    excerpt:
      "Mark your calendars. From accreditation to proclamation, here are the dates every Thomasian voter needs to know.",
    accent: "#d4a017",
    featured: true,
  },
  {
    category: "Election Watch",
    date: "September 08, 2026",
    title: "What makes a vote count? A guide to the ballot",
    excerpt:
      "A quick, clear reference for making sure your voice is read exactly as you intend.",
    accent: "#8b1e3f",
  },
  {
    category: "Commission",
    date: "August 27, 2026",
    title: "Meet the commission behind the 2026 polls",
    excerpt:
      "Get to know the student leaders and professionals stewarding this year’s election.",
    accent: "#1d5360",
  },
  {
    category: "Explainer",
    date: "August 19, 2026",
    title: "The student’s guide to election day",
    excerpt:
      "Everything you need to know before you step into the precinct.",
    accent: "#d4a017",
  },
  {
    category: "Announcement",
    date: "August 04, 2026",
    title: "Call for applications: Electoral Board 2026",
    excerpt:
      "Applications are open to Thomasians who want to serve the student body.",
    accent: "#8b1e3f",
  },
];

export const principles = [
  ["01", "Impartiality", "We protect every voter’s right to a fair and independent election."],
  ["02", "Transparency", "We make the process visible, understandable, and accountable."],
  ["03", "Participation", "We build the conditions for every Thomasian voice to be heard."],
];
import type { Metadata } from "next";

// The filing portal (/filing): political parties' members and candidates, each with one account,
// file their party's registration and their own candidacy with their Comelec unit. It shares the
// commission portal's look (portal.css) and root layout, with a sign-in and session of its own.

export const metadata: Metadata = { title: { default: "Filing Portal", template: "%s · Filing Portal" } };

export default function FilingPortalRoot({ children }: { children: React.ReactNode }) {
  return children;
}

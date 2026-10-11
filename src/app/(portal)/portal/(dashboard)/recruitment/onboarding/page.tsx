import { redirect } from "next/navigation";

/** Keep old bookmarks pointing to the Applicants settings tab. */
export default async function FormerOnboardingPage({ searchParams }: { searchParams: Promise<{ unit?: string | string[] }> }) {
  const { unit } = await searchParams;
  redirect(`/portal/recruitment/applications/onboarding${typeof unit === "string" ? `?unit=${encodeURIComponent(unit)}` : ""}`);
}

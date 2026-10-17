import type { Metadata } from "next";
import { TrackApplication } from "@/components/track-application";

export const metadata: Metadata = { title: "Track submission" };

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function TrackPage({ searchParams }: PageProps<"/apply/track">) {
  // The Receipt step links here with the new reference code filled in. An acceptance email's
  // Decline button adds the last name and `from=acceptance`: the lookup runs by itself, then asks
  // them to confirm declining.
  const { ref, last, from } = await searchParams;
  return <TrackApplication initialReference={param(ref)} initialIdentity={param(last).slice(0, 80)} fromAcceptance={param(from) === "acceptance"} />;
}

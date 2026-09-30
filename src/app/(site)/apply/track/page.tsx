import type { Metadata } from "next";
import { TrackApplication } from "@/components/track-application";

export const metadata: Metadata = { title: "Track application" };

export default async function TrackPage({ searchParams }: PageProps<"/apply/track">) {
  // The Receipt step links here with the new reference code filled in.
  const { ref } = await searchParams;
  return <TrackApplication initialReference={typeof ref === "string" ? ref : ""} />;
}

import type { Metadata } from "next";
import { EventDetailPage } from "@/components/portal/event-detail-page";

export const metadata: Metadata = { title: "Event registrants" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  return <EventDetailPage id={id} notice={notice} tab="registrants" />;
}

import { EventDetailPage } from "@/components/portal/event-detail-page";

export const metadata = { title: "Event RSVP form" };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string | string[] }> }) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  return <EventDetailPage id={id} notice={notice} tab="rsvp" />;
}

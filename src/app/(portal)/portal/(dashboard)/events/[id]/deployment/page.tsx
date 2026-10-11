import { EventDetailPage } from "@/components/portal/event-detail-page";
export const metadata = { title: "Event deployment" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventDetailPage id={id} tab="deployment" />;
}

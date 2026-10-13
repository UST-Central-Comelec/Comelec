import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EvaluationForm } from "@/components/events/evaluation-form";
import { getEventForSite } from "@/lib/events/queries";
import { getEvaluationSettings } from "@/lib/events/evaluation-store";
import "../../events.css";
export const metadata = { title: "Event evaluation", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEventForSite(id);
  if (!event) notFound();
  const settings = await getEvaluationSettings(id);
  return (
    <main className="ev ev-evaluation-page ev-application-page">
      <header className="apply-top"><div className="apply-top-inner"><div className="apply-top-title"><h1>Event evaluation</h1><p className="ev-rsvp-event">{event.name}</p></div><Link className="ev-application-back" href={`/events/${id}`}><ArrowLeft size={14} aria-hidden="true" />Back to event</Link></div></header>
      <EvaluationForm eventId={id} eventName={event.name} settings={settings} />
    </main>
  );
}

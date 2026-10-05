import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
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
    <main className="ev ev-evaluation-page">
      <header className="ev-banner">
        <div className="ev-wrap ev-evaluation-banner-inner">
          <nav className="ev-crumbs" aria-label="Breadcrumb">
            <Link href={`/events/${id}`}><ArrowLeft size={14} aria-hidden="true" />Back to event</Link>
          </nav>
          <p className="ev-eyebrow">Event evaluation</p>
          <h1 className="ev-title is-event">Share your <em>experience.</em></h1>
          <p className="ev-evaluation-lead">Your feedback helps us create better events for the Thomasian community.</p>
        </div>
      </header>
      <div className="ev-wrap ev-evaluation-layout">
        <section className="ev-form ev-evaluation-card" aria-labelledby="evaluation-event-name">
          <header className="ev-evaluation-context">
            <span className="ev-evaluation-context-icon" aria-hidden="true"><MessageSquare size={20} /></span>
            <div><p className="ev-evaluation-kicker">You’re evaluating</p><h2 className="ev-evaluation-event" id="evaluation-event-name">{event.name}</h2></div>
          </header>
          <EvaluationForm eventId={id} settings={settings} />
        </section>
      </div>
    </main>
  );
}

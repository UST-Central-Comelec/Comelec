import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/events/rsvp-form";
import { getEventForSite } from "@/lib/events/queries";
import { getRsvpSettings } from "@/lib/events/rsvp-store";
import "../../events.css";
import "@/components/events/rsvp.css";

export const metadata = { title: "Collaborator RSVP", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event, settings] = await Promise.all([getEventForSite(id), getRsvpSettings(id)]);
  if (!event || !settings) notFound();
  // Laid out like the Apply form: a slim title bar, the step tracker across the page, then the step.
  return <main className="ev ev-evaluation-page ev-rsvp-page">
    <header className="apply-top"><div className="apply-top-inner"><div className="apply-top-title"><h1>Collaborator RSVP</h1><p className="ev-rsvp-event">{event.name}</p></div></div></header>
    {settings.enabled ? <RsvpForm eventId={id} eventName={event.name} token={settings.invitation_token} definition={settings.definition ?? undefined} registrationUrl={`/events/${id}/register`} /> : <div className="ev-rsvp-closed"><div className="ev-notice"><h2>RSVP is closed.</h2><p>The organizers are not accepting collaborator responses at this time.</p></div></div>}
  </main>;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/events/rsvp-form";
import { findEditLink } from "@/lib/events/edit-requests";
import { getEventForSite } from "@/lib/events/queries";
import { isLegacyRsvp, type RsvpResponse } from "@/lib/events/rsvp";
import { getRsvpSettings } from "@/lib/events/rsvp-store";
import { createAdminClient } from "@/lib/supabase/server";
import "../../events.css";
import "@/components/events/rsvp.css";

export const metadata = { title: "Collaborator RSVP", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/** The response an accepted edit request's link opens, with its answers to prefill the form. */
async function editableResponse(eventId: string, token: string) {
  const link = await findEditLink(eventId, "rsvp", token).catch(() => null);
  if (!link?.rsvp_response_id) return null;
  const { data } = await createAdminClient().from("event_rsvp_responses").select("reference_code,email,answers").eq("id", link.rsvp_response_id).maybeSingle();
  if (!data) return null;
  const answers = data.answers as RsvpResponse["answers"];
  return { token, referenceCode: data.reference_code as string, email: data.email as string, values: isLegacyRsvp(answers) ? {} : answers.values };
}

export default async function Page({ params, searchParams }: PageProps<"/events/[id]/rsvp-form">) {
  const [{ id }, { edit }] = await Promise.all([params, searchParams]);
  const [event, settings] = await Promise.all([getEventForSite(id), getRsvpSettings(id)]);
  if (!event || !settings) notFound();
  const editing = typeof edit === "string" ? await editableResponse(id, edit) : undefined;
  // Laid out like the Apply form: a slim title bar, the step tracker across the page, then the step.
  return <main className="ev ev-evaluation-page ev-rsvp-page ev-application-page">
    <header className="apply-top"><div className="apply-top-inner"><div className="apply-top-title"><h1>{editing !== undefined ? "Edit your RSVP" : "Collaborator RSVP"}</h1><p className="ev-rsvp-event">{event.name}{editing ? ` · ${editing.referenceCode}` : ""}</p></div></div></header>
    {editing === null
      ? <div className="ev-rsvp-closed"><div className="ev-notice"><h2>This edit link can’t be used.</h2><p>It has already been used to send changes, or it’s no longer valid. To change your RSVP again, track it and request another edit.</p><div className="ev-actions"><Link className="ev-button is-ghost is-small" href="/apply/track">Track your RSVP</Link></div></div></div>
      : editing || settings.enabled
        ? <RsvpForm eventId={id} eventName={event.name} token={settings.invitation_token} definition={settings.definition ?? undefined} registrationUrl={`/events/${id}/register`} edit={editing} />
        : <div className="ev-rsvp-closed"><div className="ev-notice"><h2>RSVP is closed.</h2><p>The organizers are not accepting collaborator responses at this time.</p></div></div>}
  </main>;
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Facts, Organizer, SignUp, StatusTag } from "@/components/events/event-parts";
import { toEventView } from "@/components/events/event-view";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { isEventId } from "@/lib/events/options";
import { getEventForSite } from "@/lib/events/queries";
import "../events.css";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const event = isEventId(id) ? await getEventForSite(id) : null;
  return event ? { title: event.name, description: event.summary } : {};
}

/** The banner's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/** Where "Read more" on the Events page leads: the event's background, beside its schedule, venue and the button to register. */
export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const event = isEventId(id) ? await getEventForSite(id) : null;
  if (!event) notFound();

  const view = toEventView(event);
  const paragraphs = event.background.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);

  return (
    <main className="ev">
      <RevealOnScroll />

      <header className="ev-banner" data-hero>
        <NightSky seed={1927} count={64} />
        <div className="ev-wrap">
          <nav className="ev-crumbs" aria-label="Breadcrumb" data-enter style={enter(0)}>
            <Link href={`/events#${event.id}`}><ArrowLeft size={14} aria-hidden="true" />Events &amp; activities</Link>
          </nav>
          <div data-enter style={enter(1)}><Organizer event={view} tag /></div>
          <h1 className="ev-title is-event" data-enter style={enter(2)}>{event.name}</h1>
          <p className="ev-lede" data-enter style={enter(3)}>{event.summary}</p>
          <p className="ev-banner-meta" data-enter style={enter(4)}>
            <StatusTag event={view} />
            <span>{view.dateLabel} · {view.time}</span>
          </p>
        </div>
      </header>

      <div className="ev-wrap ev-event-layout">
        <article className="ev-event-body" aria-labelledby="ev_background_title">
          <p className="ev-eyebrow">Event background</p>
          <h2 id="ev_background_title">About this event</h2>
          {paragraphs.length > 0 ? paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>) : <p>{event.summary}</p>}
        </article>

        <aside className="ev-side ev-event-side" aria-label="Schedule, venue and registration">
          <div className="ev-card">
            <div className="ev-card-body">
              <p className="ev-eyebrow">At a glance</p>
              <Facts event={view} className="is-stacked" />
              <SignUp event={view} block />
              {view.signUp && <p className="ev-fine">{view.signUp === "waitlist" ? "Registration hasn’t opened yet. Join the waitlist with your UST Google account to hold your interest." : "You’ll verify your UST Google account first, then fill in a short form."}</p>}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

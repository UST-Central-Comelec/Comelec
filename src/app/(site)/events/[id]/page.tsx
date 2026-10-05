import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Facts, Organizer, SignUp, StatusTag } from "@/components/events/event-parts";
import { toEventView } from "@/components/events/event-view";
import { EventBackground } from "@/components/events/event-background";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { FACEBOOK_PAGE } from "@/lib/content";
import { isEventId } from "@/lib/events/options";
import { getListingForSite } from "@/lib/events/queries";
import "../events.css";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const event = isEventId(id) ? await getListingForSite(id) : null;
  return event ? { title: event.name, description: event.summary } : {};
}

/** The banner's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

/**
 * Where "Read more" on the Events page leads: the event's background, beside its schedule, venue and
 * the button to register. A unit's Recruitment, Political Party Registration or Filing of Candidacy
 * has a page here too while it's open, and stops having one when it closes.
 */
export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const event = isEventId(id) ? await getListingForSite(id) : null;
  if (!event) notFound();

  const view = toEventView(event);

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
          <EventBackground value={event.background} fallback={<p>{event.summary}</p>} />
        </article>

        <aside className="ev-side ev-event-side" aria-label="Schedule, venue and registration">
          <div className="ev-card">
            <div className="ev-card-body">
              <p className="ev-eyebrow">At a glance</p>
              <Facts event={view} className="is-stacked" />
              <SignUp event={view} block />
              {view.signUp && <p className="ev-fine">{view.period ? view.period.fine : view.signUp === "waitlist" ? "Registration hasn’t opened yet. Join the waitlist to hold your interest." : (event.requireGoogle ? "A short form in five steps. UST students and staff verify their UST Google account partway through." : "A short form in five steps.")}</p>}
              <p className="ev-fine">For the latest updates, see the <a href={FACEBOOK_PAGE} target="_blank" rel="noreferrer">Central Comelec’s Facebook page</a>.</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { toEventView } from "@/components/events/event-view";
import { EventsBoard } from "@/components/events/events-board";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { NightSky } from "@/components/night-sky";
import { dateParts, manilaToday } from "@/lib/events/format";
import { getEventsForSite } from "@/lib/events/queries";
import "./events.css";

export const metadata: Metadata = {
  title: "Events & activities",
  description: "Forums, seminars and other activities from the UST Central Comelec and every college’s Comelec unit, with online registration for Thomasians.",
};

// Rebuilt at most once a minute, so an event moves from upcoming to past on its own (saving one in
// the portal also rebuilds the page straight away).
export const revalidate = 60;

/** The banner's pieces come in one after another, in this order. */
const enter = (order: number) => ({ "--enter": order }) as CSSProperties;

const two = (value: number) => String(value).padStart(2, "0");

export default async function EventsPage() {
  // Central and Local events together, soonest first.
  const events = (await getEventsForSite()).map((event) => toEventView(event));
  // As the list counts them: everything that hasn't ended, a cancelled event included until its date passes.
  const upcoming = events.filter((event) => !event.ended);
  const open = events.filter((event) => event.signUp === "register").length;
  const nextUp = upcoming.find((event) => event.status !== "cancelled");
  const next = nextUp ? dateParts(nextUp.date) : null;

  return (
    <main className="ev">
      <RevealOnScroll />

      <header className="ev-banner" data-hero>
        <NightSky seed={1927} count={64} />
        <div className="ev-wrap ev-banner-inner">
          <div className="ev-banner-copy">
            <p className="ev-eyebrow" data-enter style={enter(0)}>On the calendar</p>
            <h1 className="ev-title" data-enter style={enter(1)}>Events &amp; <em>activities.</em></h1>
            <p className="ev-lede" data-enter style={enter(2)}>What the Central Comelec and every college’s Comelec unit have coming up. Open an event for its details, then register with your UST Google account.</p>
          </div>
          <dl className="ev-hud" data-enter style={enter(3)}>
            <div>
              <dt>Upcoming</dt>
              <dd>{two(upcoming.length)}</dd>
            </div>
            <div>
              <dt>Registration open</dt>
              <dd>{open > 0 && <i aria-hidden="true" />}{two(open)}</dd>
            </div>
            <div>
              <dt>Next up</dt>
              <dd>{next ? `${next.month} ${next.day}` : "TBA"}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="ev-wrap">
        <EventsBoard events={events} today={manilaToday()} />
      </div>
    </main>
  );
}

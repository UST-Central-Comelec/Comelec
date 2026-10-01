import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Hourglass } from "lucide-react";
import { Facts, Organizer, StatusTag } from "@/components/events/event-parts";
import { signUpNote, toEventView, type EventView } from "@/components/events/event-view";
import { EventRegistration, type RegistrationInitial } from "@/components/events/registration-form";
import { NightSky } from "@/components/night-sky";
import { checkAccess } from "@/lib/auth/session";
import { submitRegistration } from "@/lib/events/actions";
import { comelecUnit, isEventId } from "@/lib/events/options";
import { getEventForSite } from "@/lib/events/queries";
import { findRegistration, type Registration } from "@/lib/events/registrations";
import { readEventPass } from "@/lib/events/verification";
import "../../events.css";

// The form holds one person's verified email, so it's never listed by search engines.
export const metadata: Metadata = { title: "Register", robots: { index: false, follow: false } };

/** Why Google verification didn't complete, from ?verify= when Google sends the student back. */
const verifyMessages: Record<string, string> = {
  "not-ust": "That wasn’t a UST account. Sign in with your @ust.edu.ph Google account to register.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Registration isn’t available right now. Please email comelec@ust.edu.ph.",
};

const formatWhen = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** The multi-colour "G", as on the portal's sign-in button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Already signed up with this account: what's on file, in place of the form. */
function Already({ event, registration }: { event: EventView; registration: Registration }) {
  const registered = registration.status === "registered";
  return (
    <section className={`ev-done${registered ? "" : " is-waitlist"}`}>
      <span className="ev-done-mark" aria-hidden="true">{registered ? <Check size={22} strokeWidth={2.4} /> : <Hourglass size={20} />}</span>
      <h2>{registered ? <>You’re already <em>registered.</em></> : <>You’re on the <em>waitlist.</em></>}</h2>
      <p>
        <strong>{registration.email}</strong> {registered ? "registered for" : "joined the waitlist for"} <strong>{event.name}</strong> on {formatWhen(registration.registeredAt)}, as <strong>{registration.name}</strong>.{" "}
        {registered ? "Your confirmation email has the details." : "Come back to register once registration opens; the details you gave will already be filled in."}
      </p>
      <p>Need to correct something? Email <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.</p>
      <div className="ev-actions">
        <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        <a className="ev-button is-ghost is-small" href={`/events/${event.id}/register/start`} rel="nofollow">Use a different account<ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </section>
  );
}

/**
 * Where a student lands after verifying their UST Google account from an event's Register button:
 * the registration form, beside the event it's for. Without a verification for this event (opened
 * directly, or expired), it asks for one first.
 */
export default async function EventRegistrationPage({ params, searchParams }: PageProps<"/events/[id]/register">) {
  const [{ id }, { verify }] = await Promise.all([params, searchParams]);
  const event = isEventId(id) ? await getEventForSite(id) : null;
  if (!event) notFound();

  const view = toEventView(event);
  // Reads a cookie, so this page is always rendered for the visitor asking for it.
  const pass = view.signUp ? await readEventPass(event.id) : null;
  const verifyError = typeof verify === "string" ? verifyMessages[verify] : undefined;
  const startUrl = `/events/${event.id}/register/start`;

  // The verified account's form, or what stands in for it: `fallback`.
  let form: { email: string; initial: RegistrationInitial; unit: string | null; fromWaitlist: boolean } | null = null;
  let fallback: ReactNode = null;
  if (!view.signUp) {
    fallback = (
      <section className="ev-notice">
        <p className="ev-eyebrow">Registration</p>
        <h2>This event isn’t taking sign-ups.</h2>
        <p>{signUpNote(view)} Check the event’s page for its latest status.</p>
        <div className="ev-actions">
          <Link className="ev-button is-ghost is-small" href={`/events/${event.id}`}>About this event<ArrowUpRight size={15} aria-hidden="true" /></Link>
          <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        </div>
      </section>
    );
  } else if (!pass) {
    fallback = (
      <section className="ev-notice">
        <p className="ev-eyebrow">Step 1 of 2</p>
        <h2>Verify your UST account.</h2>
        <p>{view.signUp === "waitlist" ? "Joining the waitlist" : "Registration"} is for Thomasians. Sign in once with your <strong>@ust.edu.ph</strong> Google account to confirm it’s you. You won’t stay signed in: only your name and UST email are kept, for this form.</p>
        {verifyError && <p className="ev-form-error" role="alert">{verifyError}</p>}
        <div className="ev-actions">
          <a className="ev-button is-google" href={startUrl} rel="nofollow"><GoogleMark />Continue with UST Google</a>
          <Link className="ev-button is-ghost is-back" href={`/events/${event.id}`}><ArrowLeft size={16} aria-hidden="true" />About this event</Link>
        </div>
      </section>
    );
  } else {
    // What this account already has on file for the event, and whether it's a commissioner's.
    const [existing, access] = await Promise.all([
      findRegistration(event.id, pass.email).catch(() => null),
      checkAccess(pass.email).catch(() => null),
    ]);

    if (existing && (existing.status === "registered" || view.signUp === "waitlist")) {
      fallback = <Already event={view} registration={existing} />;
    } else if (existing) {
      // On the waitlist, and registration has opened: the answers they gave then, to confirm.
      form = {
        email: pass.email,
        initial: { lastName: existing.lastName, firstName: existing.firstName, middleInitial: existing.middleInitial, studentNumber: existing.studentNumber, sex: existing.sex, college: existing.college, program: existing.program, yearLevel: existing.yearLevel, organizations: existing.organizations, interest: String(existing.interest) },
        unit: null,
        fromWaitlist: true,
      };
    } else {
      // A commissioner's college and unit come filled in from their Commission Portal account.
      const commissioner = access && "user" in access ? access.user : null;
      const unit = commissioner ? comelecUnit(commissioner.affiliation, commissioner.college) : null;
      form = {
        email: pass.email,
        initial: { lastName: pass.lastName.toUpperCase(), firstName: pass.firstName.toUpperCase(), middleInitial: "", studentNumber: "", sex: "", college: commissioner?.college ?? "", program: "", yearLevel: "", organizations: unit ? [unit] : [], interest: "" },
        unit,
        fromWaitlist: false,
      };
    }
  }

  return (
    <main className="ev">
      <header className="ev-banner">
        <NightSky seed={1927} count={64} />
        <div className="ev-wrap">
          <nav className="ev-crumbs" aria-label="Breadcrumb">
            <Link href={`/events/${event.id}`}><ArrowLeft size={14} aria-hidden="true" />{event.name}</Link>
          </nav>
          <p className="ev-eyebrow">{view.signUp === "waitlist" ? "Waitlist" : "Registration"}</p>
          <h1 className="ev-title is-event">{view.signUp === "waitlist" ? <>Join the <em>waitlist.</em></> : <>Register for <em>this event.</em></>}</h1>
        </div>
      </header>

      <div className="ev-wrap ev-register-layout">
        <div className="ev-register-main">
          <EventRegistration action={submitRegistration.bind(null, event.id)} event={{ id: event.id, name: event.name }} mode={view.signUp} form={form}>{fallback}</EventRegistration>
        </div>
        <aside className="ev-side ev-register-side" aria-label="The event">
          <div className="ev-card">
            <Organizer event={view} />
            <div className="ev-card-body">
              <h2 className="ev-card-title">{event.name}</h2>
              <div><StatusTag event={view} /></div>
              <Facts event={view} className="is-stacked" />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

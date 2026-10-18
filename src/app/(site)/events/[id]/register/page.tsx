import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Hourglass } from "lucide-react";
import { Facts, Organizer, StatusTag } from "@/components/events/event-parts";
import { signUpNote, toEventView, type EventView } from "@/components/events/event-view";
import { EventRegistration } from "@/components/events/registration-form";
import { resubmitRegistration, submitRegistration } from "@/lib/events/actions";
import { findEditLink } from "@/lib/events/edit-requests";
import { allowedAffiliations, isEventId, sexChoices, type RequestKind } from "@/lib/events/options";
import { getEventForSite } from "@/lib/events/queries";
import { findRegistration, getRegistration, type Registration } from "@/lib/events/registrations";
import { emptyRegistration } from "@/lib/events/schema";
import { readEventPass } from "@/lib/events/verification";
import "../../events.css";
import { ensureReferenceData } from "@/lib/reference/store";

type FormSetup = NonNullable<Parameters<typeof EventRegistration>[0]["form"]>;

// The form can hold one person's verified email, so it's never listed by search engines.
export const metadata: Metadata = { title: "Register", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Why Google verification didn't complete, from ?verify= when Google sends the student back. */
const verifyMessages: Record<string, string> = {
  "not-ust": "That wasn’t a UST account. Sign in with your @ust.edu.ph Google account to register.",
  failed: "Google sign-in didn’t complete. Please try again.",
  "rate-limited": "Too many sign-in attempts from this network. Wait a few minutes, then try again.",
  unavailable: "Registration isn’t available right now. Please email comelec@ust.edu.ph.",
};

const formatWhen = (iso: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Already signed up with this account: what's on file, in place of the form. */
function Already({ event, registration }: { event: EventView; registration: Registration }) {
  const registered = registration.status === "registered";
  return (
    <section className={`ev-done${registered ? "" : " is-waitlist"}`}>
      <span className="ev-done-mark" aria-hidden="true">{registered ? <Check size={22} strokeWidth={2.4} /> : <Hourglass size={20} />}</span>
      <h2>{registered ? <>You’re already <em>registered.</em></> : <>You’re on the <em>waitlist.</em></>}</h2>
      <p>
        <strong>{registration.email}</strong> {registered ? "registered for" : "joined the waitlist for"} <strong>{event.name}</strong> on {formatWhen(registration.registeredAt)}, as <strong>{registration.name}</strong>.{" "}
        {registered ? "Your confirmation email has the details." : "If places become available, come back to register; the details you gave will already be filled in."}
      </p>
      <p>Need to correct something? Email <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.</p>
      <div className="ev-actions">
        <Link className="ev-button is-ghost is-small is-back" href="/events"><ArrowLeft size={15} aria-hidden="true" />All events</Link>
        <a className="ev-button is-ghost is-small" href={`/events/${event.id}/register/start`} rel="nofollow">Use a different UST account<ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </section>
  );
}

/** A registration's answers as the form holds them, to change through an edit link. */
function answersOf(registration: Registration): FormSetup["initial"] {
  const { parking, dietary } = registration.requests;
  return {
    ...emptyRegistration(),
    consent: true, studentNumber: registration.studentNumber ?? "", lastName: registration.lastName, firstName: registration.firstName,
    middleName: registration.middleName.length > 1 ? registration.middleName : "", sex: registration.sex in sexChoices ? registration.sex : "", dateOfBirth: registration.dateOfBirth ?? "",
    email: registration.email, affiliation: registration.affiliation, college: registration.college ?? "", program: registration.program ?? "", yearLevel: registration.yearLevel ?? "",
    office: registration.office ?? "", institution: registration.institution ?? "", attendingAs: registration.attendingAs, organizationName: registration.organizationName ?? "",
    organizationCommittee: registration.organizationCommittee ?? "", organizationPosition: registration.organizationPosition ?? "",
    requests: Object.keys(registration.requests) as RequestKind[],
    parkingPlate: parking?.plate ?? "", parkingModel: parking?.model ?? "", parkingColor: parking?.color ?? "", parkingArrival: parking?.arrival ?? "", dietaryAllergens: dietary?.allergens ?? "",
  };
}

/** An edit link that's been used, or never worked. */
function EditLinkGone({ eventId }: { eventId: string }) {
  return (
    <section className="ev-notice">
      <p className="ev-eyebrow">Edit link</p>
      <h2>This edit link can’t be used.</h2>
      <p>It has already been used to send changes, or it’s no longer valid. To change your registration again, track it and request another edit.</p>
      <div className="ev-actions">
        <Link className="ev-button is-ghost is-small" href="/apply/track">Track your registration<ArrowUpRight size={15} aria-hidden="true" /></Link>
        <Link className="ev-button is-ghost is-small is-back" href={`/events/${eventId}`}><ArrowLeft size={15} aria-hidden="true" />About this event</Link>
      </div>
    </section>
  );
}

/**
 * An event's registration form, beside the event it's for: open to anyone the event is open to.
 * Someone registering as a UST student or staff member at an event that requires it verifies their UST
 * Google account partway through, and lands back here with a pass for this event.
 */
export default async function EventRegistrationPage({ params, searchParams }: PageProps<"/events/[id]/register">) {
  await ensureReferenceData();
  const [{ id }, { verify, edit }] = await Promise.all([params, searchParams]);
  const event = isEventId(id) ? await getEventForSite(id) : null;
  if (!event) notFound();

  const view = toEventView(event);

  // From an accepted edit request's link: the registration, prefilled, to change and send again.
  if (typeof edit === "string") {
    const link = await findEditLink(event.id, "registration", edit).catch(() => null);
    const registration = link?.registration_id ? await getRegistration(link.registration_id).catch(() => null) : null;
    const editForm: FormSetup | null = registration ? { initial: answersOf(registration), verifiedEmail: registration.verified ? registration.email : null, requireGoogle: event.requireGoogle, allowed: allowedAffiliations(), fromWaitlist: false, editToken: edit } : null;
    return (
      <main className="ev ev-application-page ev-register-page">
        <header className="apply-top">
          <div className="apply-top-inner">
            <div className="apply-top-title">
              <h1>Edit your registration</h1>
              <p className="ev-rsvp-event">{event.name}{registration ? ` · ${registration.referenceCode}` : ""}</p>
            </div>
            <Link className="ev-application-back" href={`/events/${event.id}`}><ArrowLeft size={14} aria-hidden="true" />Back to event</Link>
          </div>
        </header>
        <EventRegistration action={resubmitRegistration.bind(null, event.id, edit)} event={{ id: event.id, name: event.name }} mode={registration ? (registration.status === "waitlisted" ? "waitlist" : "register") : null} form={editForm}><EditLinkGone eventId={event.id} /></EventRegistration>
      </main>
    );
  }
  // Reads a cookie, so this page is always rendered for the visitor asking for it.
  const pass = view.signUp ? await readEventPass(event.id) : null;
  const verifyError = typeof verify === "string" ? verifyMessages[verify] : undefined;
  const allowed = allowedAffiliations();

  // The form, or what stands in for it: `fallback`.
  let form: FormSetup | null = null;
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
  } else {
    // What a verified account already has on file for the event.
    const existing = pass ? await findRegistration(event.id, pass.email).catch(() => null) : null;
    if (existing && (existing.status === "registered" || view.signUp === "waitlist")) {
      fallback = <Already event={view} registration={existing} />;
    } else {
      const base = emptyRegistration();
      form = {
        // On the waitlist, and registration has opened: the answers they gave then, to confirm.
        initial: existing
          ? { ...base, studentNumber: existing.studentNumber ?? "", consent: false, lastName: existing.lastName, firstName: existing.firstName, middleName: existing.middleName.length > 1 ? existing.middleName : "", sex: existing.sex in sexChoices ? existing.sex : "", dateOfBirth: existing.dateOfBirth ?? "", email: existing.email, affiliation: existing.affiliation, college: existing.college ?? "", program: existing.program ?? "", yearLevel: existing.yearLevel ?? "", office: existing.office ?? "", institution: existing.institution ?? "", attendingAs: existing.attendingAs, organizationName: existing.organizationName ?? "", organizationCommittee: existing.organizationCommittee ?? "", organizationPosition: existing.organizationPosition ?? "" }
          : pass
            ? { ...base, lastName: pass.lastName.toUpperCase(), firstName: pass.firstName.toUpperCase(), email: pass.email }
            : base,
        verifiedEmail: pass?.email ?? null,
        requireGoogle: event.requireGoogle,
        allowed,
        fromWaitlist: Boolean(existing),
        verifyError,
      };
    }
  }

  const aside = (
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
  );

  // Laid out like the RSVP and the Apply form: a slim title bar, the step tracker across the page, then the step.
  return (
    <main className="ev ev-application-page ev-register-page">
      <header className="apply-top">
        <div className="apply-top-inner">
          <div className="apply-top-title">
            <h1>{view.signUp === "waitlist" ? "Join the waitlist" : "Register for this event"}</h1>
            <p className="ev-rsvp-event">{event.name}</p>
          </div>
          <Link className="ev-application-back" href={`/events/${event.id}`}><ArrowLeft size={14} aria-hidden="true" />Back to event</Link>
        </div>
      </header>
      <EventRegistration action={submitRegistration.bind(null, event.id)} event={{ id: event.id, name: event.name }} mode={view.signUp} form={form} aside={aside}>{fallback}</EventRegistration>
    </main>
  );
}

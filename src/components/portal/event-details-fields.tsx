"use client";

import { SlidingSegments } from "./sliding-filters";

import { useId, useRef, useState } from "react";
import { UsersRound } from "lucide-react";
import { audiences, venueModes, type Audience, type EventDetails, type VenueMode } from "@/lib/events/options";
import { isActivityNature, naturesFor, venueTypes, type VenueType } from "@/lib/events/activity-checklist";
import { Dropdown } from "./dropdown";
import { EventCollaborators } from "./event-collaborators";
import { Field } from "./portal-form";
import { InfoTip } from "./info-tip";
import { TimePicker } from "./time-picker";
import { DatePicker } from "./date-picker";
import { EventScheduleFields, type DateValidation } from "./event-schedule-fields";
import type { CalendarHighlight } from "@/lib/calendar/options";
import { EmailEditor } from "./email-editor";
import { bodyEditorHtml } from "@/lib/email/body";
import { readBackground, writeBackground } from "@/lib/events/background";
import { AddIcon } from "@/components/action-icons";
import { DeleteButton } from "./delete-button";

/** Each participants checkbox: its form field, and who it means. */
const audienceFields: Record<Audience, { field: "openToStudents" | "openToExternals" | "openToAdmins" | "openToInternal"; hint: string }> = {
  students: { field: "openToStudents", hint: "Students of the University." },
  externals: { field: "openToExternals", hint: "Guests from outside the University." },
  admins: { field: "openToAdmins", hint: "University administrators, faculty and staff." },
  internal: { field: "openToInternal", hint: "Comelec and collaborators only." },
};

const venuePlaceholders: Record<VenueMode, string> = {
  onsite: "Room and building, e.g. Auditorium, Tan Yan Kee Student Center",
  online: "Platform and how to get the link, e.g. Zoom, link emailed to registrants",
  both: "Room and building, plus online platform and how to get the link",
};

/**
 * An event's details, as the event form asks for them: what it is, its day and times, its venue and
 * who it's open to. The same fields sit under a unit's Recruitment, Political Party and Filing of
 * Candidacy settings, which are listed with the events while they're open. Times are picked in
 * five-minute steps. The server reads them back with readDetails (src/lib/events/details.ts).
 */
export function EventDetailsFields({ initial, errors, what = "event", requireGoogle, activity = false, allowBothVenue = false, allowMultipleVenues = false, studentsOnly = false, hideRegistrationControls = false, calendarHighlights = [], dateValidation }: {
  calendarHighlights?: CalendarHighlight[];
  dateValidation?: DateValidation;
  initial: EventDetails;
  /** An event's e-ReSERVe venue type and nature of activity, in place of how it's held. Its checklist documents follow from them. */
  activity?: boolean;
  /** Events, Recruitment and Filing of Candidacy can offer on-site and online options together. */
  allowBothVenue?: boolean;
  allowMultipleVenues?: boolean;
  /** Recruitment is open exclusively to University students. */
  studentsOnly?: boolean;
  /** The event's switch for Google verification. A unit's Recruitment, Political Party and Filing of Candidacy always verify. */
  requireGoogle?: boolean;
  hideRegistrationControls?: boolean;
  errors: Record<string, string>;
  /** What the details describe, for the hints: "event", or "listing" for a unit's settings. */
  what?: "event" | "listing";
}) {
  const [venueType, setVenueType] = useState<VenueType>(initial.venueType ?? (initial.venueMode === "online" ? "online" : "in-campus"));
  const [nature, setNature] = useState(initial.natureOfActivity ?? "");
  const [heldMode, setVenueMode] = useState<VenueMode>(initial.venueMode);
  const venueMode: VenueMode = activity ? (venueType === "online" ? "online" : "onsite") : heldMode;
  const natureLabel = useId();
  const [venues, setVenues] = useState(() => (allowMultipleVenues ? initial.venueDetails.split("\n") : [initial.venueDetails]).map((value, id) => ({ id, value })));
  const nextVenueId = useRef(venues.length);
  // Kept here so an empty ingress or egress can start from the activity's own times.
  const [startsTime, setStartsTime] = useState(initial.startsTime);
  const [endsTime, setEndsTime] = useState(initial.endsTime);
  const [startDate, setStartDate] = useState(initial.eventDate);
  const [endDate, setEndDate] = useState(initial.endDate || initial.eventDate);
  const listing = what === "listing";
  const [openToStudents, setOpenToStudents] = useState(studentsOnly || initial.openToStudents);
  const [openToInternal, setOpenToInternal] = useState(initial.openToInternal ?? false);
  const venueLabel = useId();
  const backgroundLabel = useId();
  const [background, setBackground] = useState(initial.background);

  return (
    <>
      <fieldset className="portal-form-section">
        <legend>{listing ? "The listing" : "The event"}</legend>
        <div className="portal-form-grid">
          <Field label={listing ? "Name" : "Event name"} hint={listing ? "What it’s listed as on the Events page." : undefined} error={errors.name} wide>
            <input name="name" defaultValue={initial.name} maxLength={140} required />
          </Field>
          <Field label="Short description" hint={`Shown when the ${what} is opened in the website’s list, and under its name on its own page. One or two sentences.`} error={errors.summary} wide>
            <textarea name="summary" rows={3} defaultValue={initial.summary} maxLength={300} required />
          </Field>
          <div className={`portal-field is-wide${errors.background ? " has-error" : ""}`}>
            <span className="portal-field-label" id={backgroundLabel}>{listing ? "Background" : "Event background"}</span>
            <EmailEditor numberedLists={false} initialHtml={bodyEditorHtml(readBackground(initial.background))} labelledBy={backgroundLabel} invalid={Boolean(errors.background)} placeholder="Describe the event and what to expect…" onChange={(body) => setBackground(writeBackground(body))} />
            <input type="hidden" name="background" value={background} />
            {errors.background && <span className="portal-field-error">{errors.background}</span>}
          </div>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>{listing ? "Dates" : "Date and time"}</legend>
        {/* In pairs: the days, then ingress and egress, then the activity's own start and end. */}
        <div className="portal-form-grid is-schedule">
          {listing ? (
            <>
              <Field label="Start date" hint="It opens on this day, at the opening time below. Times are Manila time, in five-minute steps." error={errors.eventDate}>
                <DatePicker name="eventDate" value={startDate} invalid={Boolean(errors.eventDate)} onChange={(next) => { setStartDate(next); if (next && endDate < next) setEndDate(next); }} required />
              </Field>
              <Field label="End date" hint="It closes on this day, at the closing time below, by itself: there’s no need to close it by hand." error={errors.endDate}>
                <DatePicker name="endDate" value={endDate} min={startDate} invalid={Boolean(errors.endDate)} onChange={setEndDate} required />
              </Field>
            </>
          ) : (
            <EventScheduleFields start={startDate} end={endDate} onChange={(start, end) => { setStartDate(start); setEndDate(end); }} errors={errors} highlights={calendarHighlights} validationRef={dateValidation} />
          )}
          <Field label="Ingress" hint="When participants can start coming in, on the start date. Optional." error={errors.ingressTime}>
            <TimePicker name="ingressTime" defaultValue={initial.ingressTime ?? ""} optional suggest={startsTime} invalid={Boolean(errors.ingressTime)} />
          </Field>
          <Field label="Egress" hint="When participants should have left the venue, on the end date. Optional." error={errors.egressTime}>
            <TimePicker name="egressTime" defaultValue={initial.egressTime ?? ""} optional suggest={endsTime} invalid={Boolean(errors.egressTime)} />
          </Field>
          <Field label={listing ? "Opens at" : "Activity starts"} hint={listing ? undefined : "When the program itself begins, on the start date. Times are Manila time, in five-minute steps."} error={errors.startsTime}>
            <TimePicker name="startsTime" value={startsTime} onChange={setStartsTime} invalid={Boolean(errors.startsTime)} />
          </Field>
          <Field label={listing ? "Closes at" : "Activity ends"} hint={listing ? undefined : "When the program ends, on the end date."} error={errors.endsTime}>
            <TimePicker name="endsTime" value={endsTime} onChange={setEndsTime} suggest={startsTime} invalid={Boolean(errors.endsTime)} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="portal-form-section">
        <legend>Venue</legend>
        <div className="portal-form-grid is-venue">
          {activity ? <>
            <div className={`portal-field is-wide${errors.venueType ? " has-error" : ""}`}>
              <span className="portal-field-label" id={venueLabel}>Venue type<InfoTip label="About the venue type">As e-ReSERVe sorts activities. With the nature of activity, it picks the documents added under Documentations.</InfoTip></span>
              <SlidingSegments active={venueType} role="radiogroup" aria-labelledby={venueLabel} className="is-venue-types">
                {(Object.keys(venueTypes) as VenueType[]).map((type) => (
                  <label key={type} className={`portal-segment${venueType === type ? " is-selected" : ""}`}>
                    <input type="radio" name="venueType" value={type} checked={venueType === type} onChange={() => { setVenueType(type); if (!isActivityNature(nature, type)) setNature(""); }} />
                    {venueTypes[type]}
                  </label>
                ))}
              </SlidingSegments>
              <input type="hidden" name="venueMode" value={venueMode} />
              {errors.venueType && <span className="portal-field-error">{errors.venueType}</span>}
            </div>
            <div className={`portal-field${errors.natureOfActivity ? " has-error" : ""}`}>
              <span className="portal-field-label" id={natureLabel}>Nature of activity<InfoTip label="About the nature of activity">Only the natures e-ReSERVe offers for this venue type are listed.</InfoTip></span>
              <Dropdown name="natureOfActivity" required labelledBy={natureLabel} value={nature} onChange={setNature} placeholder="Choose the nature of activity" invalid={Boolean(errors.natureOfActivity)} options={naturesFor(venueType).map(value => ({ value, label: value }))} />
              {errors.natureOfActivity && <span className="portal-field-error">{errors.natureOfActivity}</span>}
            </div>
          </> : <div className={`portal-field${errors.venueMode ? " has-error" : ""}`}>
            <span className="portal-field-label" id={venueLabel}>Held</span>
            <SlidingSegments active={venueMode} role="radiogroup" aria-labelledby={venueLabel}>
              {(Object.keys(venueModes) as VenueMode[]).filter((mode) => mode !== "both" || allowBothVenue).map((mode) => (
                <label key={mode} className={`portal-segment${venueMode === mode ? " is-selected" : ""}`}>
                  <input type="radio" name="venueMode" value={mode} checked={venueMode === mode} onChange={() => setVenueMode(mode)} />
                  {mode === "both" ? "Both" : venueModes[mode]}
                </label>
              ))}
            </SlidingSegments>
            {errors.venueMode && <span className="portal-field-error">{errors.venueMode}</span>}
          </div>}
          {allowMultipleVenues ? <div className="portal-venue-list">
            {venues.map((venue, index) => <div className="portal-venue-row" key={venue.id}>
              <Field label={`Venue ${index + 1}`} error={index === 0 ? errors.venueDetails : undefined}>
                <input name="venueDetails" value={venue.value} onChange={event => setVenues(rows => rows.map(row => row.id === venue.id ? { ...row, value: event.target.value } : row))} maxLength={300} minLength={2} placeholder={venuePlaceholders[venueMode]} required />
              </Field>
              {venues.length > 1 && <DeleteButton label="Remove venue" prompt="Remove this venue?" confirmLabel="Remove venue" action={async () => { setVenues(rows => rows.filter(row => row.id !== venue.id)); }} />}
            </div>)}
            <button type="button" className="portal-button is-ghost is-small" disabled={venues.length >= 10} onClick={() => { const id = nextVenueId.current++; setVenues(rows => [...rows, { id, value: "" }]); }}><AddIcon size={15} aria-hidden="true" />Add venue</button>
          </div> : <Field label={venueMode === "both" ? "Venue and online platform" : venueMode === "online" ? "Platform and link" : "Where"} error={errors.venueDetails}>
            <input name="venueDetails" defaultValue={initial.venueDetails} maxLength={300} placeholder={venuePlaceholders[venueMode]} required />
          </Field>}
        </div>
      </fieldset>

      <fieldset className={`portal-form-section portal-field${errors.participants ? " has-error" : ""}`}>
        <legend>Participants</legend>
        {studentsOnly && <input type="hidden" name="openToStudents" value="on" />}
        {studentsOnly ? (
          <div className="portal-participants-fixed">
            <UsersRound size={17} strokeWidth={1.6} aria-hidden="true" />
            <span><strong>Students only</strong><small>{audienceFields.students.hint}</small></span>
          </div>
        ) : (
          <div className="portal-options">
            {(Object.keys(audiences) as Audience[]).filter(audience => audience !== "internal" || !listing).map((audience) => (
              <label className="portal-check" key={audience}>
                {audience === "students"
                  ? <input name="openToStudents" type="checkbox" checked={openToStudents} onChange={(event) => setOpenToStudents(event.target.checked)} />
                  : audience === "internal"
                    ? <input name="openToInternal" type="checkbox" checked={openToInternal} onChange={event => setOpenToInternal(event.target.checked)} />
                    : <input name={audienceFields[audience].field} type="checkbox" defaultChecked={initial[audienceFields[audience].field]} />}
                <span><strong>{audiences[audience]}</strong><small>{audienceFields[audience].hint}</small></span>
              </label>
            ))}
          </div>
        )}
        {errors.participants && <span className="portal-field-error">{errors.participants}</span>}
      </fieldset>
      {!listing && !studentsOnly && openToInternal && <EventCollaborators initial={initial} errors={errors} />}
      {!hideRegistrationControls && (!listing || openToStudents) && (
        <label className="portal-check portal-google-check">
          {listing
            ? <input type="checkbox" checked disabled readOnly />
            : <input name="requireGoogle" type="checkbox" defaultChecked={requireGoogle ?? true} />}
          <span>
            <strong>Require student authentication via Google Sign-In<InfoTip label="About Google Sign-In authentication">{listing
              ? "Always on: applicants verify their UST Google account on its own form."
              : "UST students, faculty and staff verify their @ust.edu.ph account before their registration is taken, and that email is the one kept. Untick it to let everyone type their email."}</InfoTip></strong>
          </span>
        </label>
      )}
    </>
  );
}

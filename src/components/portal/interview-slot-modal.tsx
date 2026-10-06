"use client";

import { useId, type ReactNode } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import type { AdminInterviewSlot } from "@/lib/applications/interviews";
import { interviewModes, slotDate, slotDay, slotTimeRange } from "@/lib/applications/interview-format";
import { applicantDisplayName } from "@/lib/applications/name";
import { deleteInterviewSlot } from "@/lib/portal/interview-actions";
import { ApplicationModal } from "./application-modal";
import { ReviewModalDetailsGroup } from "./review-modal-ui";

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children || <span className="portal-muted">Not provided</span>}</dd></div>;
}

export function InterviewSlotModal({ slot, readOnly, onClose }: {
  slot: AdminInterviewSlot;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const status = slot.booked > 0 ? "Booked" : "Available";

  return (
    <ApplicationModal titleId={titleId} onClose={onClose}>
      <article className="portal-registrant-receipt portal-application-receipt">
        <header className="portal-registrant-receipt-head">
          <div className="portal-registrant-heading">
            <div className="portal-modal-name-status">
              <h2 id={titleId}>Interview slot</h2>
              <span className={`portal-tag ${slot.booked > 0 ? "is-ok" : ""}`}>{status}</span>
            </div>
            <div className="portal-registrant-meta"><span className="portal-registrant-date">{slotDate(slot.startsAt)} · {slotTimeRange(slot.startsAt, slot.durationMinutes)}</span></div>
          </div>
        </header>
        <div className="portal-registrant-receipt-body">
          <div className="portal-registrant-groups">
            <ReviewModalDetailsGroup title="Interview details" number="01">
              <Detail label="Date">{slotDate(slot.startsAt)}</Detail>
              <Detail label="Time">{slotTimeRange(slot.startsAt, slot.durationMinutes)}</Detail>
              <Detail label="Online or Onsite">{interviewModes[slot.mode]}</Detail>
              <Detail label="Available or Booked">{status}</Detail>
              {slot.location && <Detail label="Location">{slot.location}</Detail>}
            </ReviewModalDetailsGroup>
            {slot.bookings.length === 0 ? <p className="portal-muted">No applicant has booked this slot.</p> : slot.bookings.map((booking, index) => (
              <ReviewModalDetailsGroup key={booking.id} title={slot.bookings.length > 1 ? `Applicant who booked: ${applicantDisplayName(booking)}` : "Applicant who booked"} number={String(index + 2).padStart(2, "0")}>
                <Detail label="Last Name">{booking.lastName}</Detail>
                <Detail label="First Name">{booking.firstName}</Detail>
                <Detail label="Middle Name">{booking.middleName}</Detail>
                <Detail label="Email">{booking.email && <a href={`mailto:${booking.email}`}>{booking.email}</a>}</Detail>
                <Detail label="Facebook link">{booking.facebookUrl && <a href={booking.facebookUrl} target="_blank" rel="noreferrer">Open profile <ExternalLink size={13} /></a>}</Detail>
                <Detail label="College/Faculty">{booking.college}</Detail>
                <Detail label="Program">{booking.program}</Detail>
                <Detail label="Year Level">{booking.yearLevel}</Detail>
                <Detail label="Position Applied to">{booking.position}</Detail>
              </ReviewModalDetailsGroup>
            ))}
          </div>
        </div>
        {slot.booked === 0 && !readOnly && <footer className="portal-registrant-receipt-foot">
          <form action={deleteInterviewSlot.bind(null, slot.id, slotDay(slot.startsAt))} className="portal-registrant-actions">
            <button className="portal-button is-ghost" type="submit"><Trash2 size={15} aria-hidden="true" />Delete slot</button>
          </form>
        </footer>}
      </article>
    </ApplicationModal>
  );
}

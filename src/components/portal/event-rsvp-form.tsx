"use client";
import type { ReactNode } from "react";
import { defaultRsvpDefinition, type RsvpSettings } from "@/lib/events/rsvp";
import type { EditorDefinition } from "@/lib/events/form-editor";
import { RsvpForm } from "@/components/events/rsvp-form";
import { EventFormEditor, type Mode } from "./event-form-editor";
import { FormPreview } from "./form-preview";

/** The RSVP's editor. Every question in it can be changed; Reset brings back the starting form. */
export function EventRsvpForm({ settings, editable, onChange, actions, viewMode, eventId = "preview", eventName = "This event" }: { eventId?: string; eventName?: string; settings: RsvpSettings | null; editable: boolean; onChange?: (definition: EditorDefinition) => void; actions?: ReactNode; viewMode?: Mode }) {
  return <EventFormEditor
    actions={actions}
    viewMode={viewMode}
    title="RSVP Form"
    value={settings?.definition ?? defaultRsvpDefinition}
    defaultValue={defaultRsvpDefinition}
    onChange={definition => onChange?.(definition)}
    disabled={!editable || !onChange}
    allowRating={false}
    renderPreview={definition => <FormPreview><RsvpForm eventId={eventId} eventName={eventName} token="" preview definition={definition} registrationUrl={`/events/${eventId}/register`} /></FormPreview>}
  />;
}

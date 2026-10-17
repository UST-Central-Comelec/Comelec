"use client";
import type { ReactNode } from "react";
import { defaultRsvpDefinition, type RsvpSettings } from "@/lib/events/rsvp";
import type { EditorDefinition } from "@/lib/events/form-editor";
import { EventFormEditor } from "./event-form-editor";

/** The RSVP's editor. Every question in it can be changed; Reset brings back the starting form. */
export function EventRsvpForm({ settings, editable, onChange, actions, headerActions, resetDisabled }: { settings: RsvpSettings | null; editable: boolean; onChange?: (definition: EditorDefinition) => void; actions?: ReactNode; headerActions?: ReactNode; resetDisabled?: boolean }) {
  return <EventFormEditor
    actions={actions}
    headerActions={headerActions}
    resetDisabled={resetDisabled}
    title="RSVP Form"
    value={settings?.definition ?? defaultRsvpDefinition}
    defaultValue={defaultRsvpDefinition}
    onChange={definition => onChange?.(definition)}
    disabled={!editable || !onChange}
    allowRating={false}
  />;
}

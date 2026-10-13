"use client";
import type { ReactNode } from "react";
import "@/app/(site)/events/events.css";
import "@/components/events/rsvp.css";

/** The public form's own styles, inside the portal and in the portal's theme (event-form-editor.css). */
export function FormPreview({ children }: { children: ReactNode }) {
  return <div className="ev ev-form-preview">{children}</div>;
}

"use client";

import { ViewIcon } from "@/components/action-icons";
import { storeFormView, type FormViewDraft } from "@/lib/forms/view-mode";
import { toast } from "./toast";

/** Open the current draft in the same standalone View Mode used by recruitment. */
export function FormViewModeButton({ draft }: { draft: FormViewDraft }) {
  return <a className="portal-button is-ghost" href="/forms/preview" target="_blank" rel="noopener noreferrer" onClick={event => {
    try {
      event.currentTarget.href = storeFormView(localStorage, draft, crypto.randomUUID());
    } catch {
      event.preventDefault();
      toast("Couldn’t open View Mode. Allow browser storage and try again.", "error");
    }
  }}>View Mode <ViewIcon size={15} aria-hidden="true" /></a>;
}

"use client";

import { SlidingSegments } from "./sliding-filters";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { CodeKey } from "@/lib/codes/options";
import type { CodeVisibility } from "@/lib/codes/settings";
import { updateCodeVisibility } from "@/lib/portal/code-settings-actions";
import { useHydrated, usePortalForm } from "./portal-form";

export function CodeSettingsForm({ code, visibility: saved, readOnly }: { code: CodeKey; visibility: CodeVisibility; readOnly: boolean }) {
  const { pending, onSubmit } = usePortalForm(updateCodeVisibility.bind(null, code));
  const [visibility, setVisibility] = useState(saved);
  const hydrated = useHydrated();
  const id = useId();
  const unchanged = visibility === saved;

  return (
    <form className="portal-settings-form" onSubmit={onSubmit}>
      <div className="portal-setting">
        <div className="portal-setting-label"><span id={`${id}-visibility`}>Public visibility</span></div>
        <div className="portal-setting-control">
          <SlidingSegments active={visibility} role="radiogroup" aria-labelledby={`${id}-visibility`}>
            <label className={`portal-segment${visibility === "published" ? " is-selected" : ""}`}>
              <input type="radio" name="visibility" value="published" checked={visibility === "published"} onChange={() => setVisibility("published")} disabled={readOnly || pending} />
              <Eye size={15} aria-hidden="true" /> Publish
            </label>
            <label className={`portal-segment is-closed${visibility === "hidden" ? " is-selected" : ""}`}>
              <input type="radio" name="visibility" value="hidden" checked={visibility === "hidden"} onChange={() => setVisibility("hidden")} disabled={readOnly || pending} />
              <EyeOff size={15} aria-hidden="true" /> Hide
            </label>
          </SlidingSegments>
          <p className="portal-muted">Publish makes the current approved text available on the public website. Hide removes public access. The document and its revisions remain in the portal; drafts still need approval.</p>
        </div>
      </div>
      {!readOnly && <footer className={`portal-settings-foot${unchanged ? "" : " is-dirty"}`}>
        <span className="portal-settings-dirty" aria-live="polite">{unchanged ? "" : "Unsaved changes"}</span>
        <div className="portal-form-actions">
          {!unchanged && <button className="portal-button is-ghost" type="button" onClick={() => setVisibility(saved)} disabled={pending}>Discard</button>}
          <button className="portal-button" type="submit" disabled={pending || !hydrated || unchanged}>{pending ? "Saving…" : unchanged ? "Saved" : "Save settings"}</button>
        </div>
      </footer>}
    </form>
  );
}

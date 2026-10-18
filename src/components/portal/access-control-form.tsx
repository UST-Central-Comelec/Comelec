"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { ViewIcon as Eye, HideIcon as EyeOff, SaveIcon as Save } from "@/components/action-icons";
import { LockOpenIcon } from "./lock-open-icon";
import { UnsavedAccessGuard } from "./unsaved-access-guard";
import { AccessControlLoader } from "./access-control-loader";
import { AccessFlowMap } from "./access-flow-map";
import type { GroupLabel, TabKey } from "@/lib/portal/access";
import type { FormState } from "@/lib/portal/form";
import { useHydrated, usePortalForm } from "./portal-form";
import { Busy } from "@/components/busy";

/** The saved and default permissions represented by a diagram node. */
export type AccessTab = { key: TabKey; label: string; on: boolean; byDefault: boolean; fixed: boolean; centralOnly: boolean; boardOnly: boolean };
/** A main tab and its subtabs. The Dashboard has no main tab, so its `label` is null. */
export type AccessGroup = { section?: string | null; label: GroupLabel | null; tabs: AccessTab[] };

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Stands in for the action where there's nothing to save. */
const noAction: FormAction = async () => undefined;

const sameSet = (a: ReadonlySet<TabKey>, b: ReadonlySet<TabKey>) => a.size === b.size && [...a].every((key) => b.has(key));
const confirmationPhrase = "UST-Central-Comelec";

/** A level → tab group → tab tree, backed by the same saved permissions as the sidebar. */
export function AccessControlForm({ action, groups, updated, levelName, rolePicker }: { rolePicker: ReactNode; action: FormAction | null; groups: AccessGroup[]; updated: string | null; levelName: string }) {
  const { pending, onSubmit } = usePortalForm(action ?? noAction);
  const hydrated = useHydrated();
  const [canvasReady, setCanvasReady] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activationProgress, setActivationProgress] = useState(0);
  const [fadingLoader, setFadingLoader] = useState(false);
  const onCanvasReady = useCallback(() => setCanvasReady(true), []);
  useEffect(() => {
    if (!canvasReady) return;
    const started = performance.now();
    let frame: number;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const advance = (now: number) => {
      const progress = Math.min(100, Math.floor((now - started) / 8000 * 100));
      setActivationProgress(progress);
      if (progress < 100) frame = requestAnimationFrame(advance);
      else {
        setFadingLoader(true);
        timer = setTimeout(() => setActivated(true), 600);
      }
    };
    frame = requestAnimationFrame(advance);
    return () => { cancelAnimationFrame(frame); if (timer !== undefined) clearTimeout(timer); };
  }, [canvasReady]);
  const tabs = groups.flatMap((group) => group.tabs);
  const saved = new Set(tabs.filter((tab) => tab.on).map((tab) => tab.key));
  const defaults = new Set(tabs.filter((tab) => tab.byDefault).map((tab) => tab.key));
  const [open, setOpen] = useState<ReadonlySet<TabKey>>(saved);
  const securityDialog = useRef<HTMLDialogElement>(null);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const confirmationInputId = useId();
  const focusConfirmationInput = useCallback((input: HTMLInputElement | null) => { input?.focus(); }, []);
  const securityTitleId = useId();
  const securityDescriptionId = useId();

  const unchanged = sameSet(open, saved);
  const atDefaults = sameSet(open, defaults);
  const locked = action === null;
  const gained = tabs.filter(tab => open.has(tab.key) && !saved.has(tab.key));
  const lost = tabs.filter(tab => saved.has(tab.key) && !open.has(tab.key));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (locked || unchanged || pending || !hydrated) {
      event.preventDefault();
      return;
    }
    if (!securityOpen) {
      event.preventDefault();
      setConfirmationStep(false);
      setConfirmationText("");
      setShowConfirmation(false);
      securityDialog.current?.showModal();
      setSecurityOpen(true);
      return;
    }
    if (!confirmationStep || confirmationText !== confirmationPhrase) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };

  const set = (keys: TabKey[], on: boolean) =>
    setOpen((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });

  return (
    <UnsavedAccessGuard dirty={!unchanged && !pending}>
    {!activated && <AccessControlLoader progress={activationProgress} exiting={fadingLoader} />}
    <form className={`portal-settings-form portal-access-form${!fadingLoader && !activated ? " is-activating" : ""}`} onSubmit={submit} noValidate inert={!activated} aria-busy={!activated}>
      {/* Keep the server action's tab payload independent of the diagram controls. */}
      {tabs.filter((tab) => open.has(tab.key)).map((tab) => <input key={tab.key} type="hidden" name="tab" value={tab.key} />)}
      <AccessFlowMap immersive groups={groups} open={open} levelName={levelName} disabled={pending || !hydrated} onChange={set} onReady={onCanvasReady}
        resetControl={<button type="button" className="portal-flow-display-toggle" title="Reset to last saved access" aria-label="Reset to last saved access" onClick={() => setOpen(new Set(saved))} disabled={locked || unchanged || pending || !hydrated}><RotateCcw size={14} aria-hidden="true" /></button>}
        saveControl={<button type="submit" className="portal-flow-display-toggle" aria-label={pending ? "Saving access" : "Save access"} title={locked ? "Fixed access" : pending ? "Saving access" : unchanged ? "Access already saved" : "Save access"} disabled={locked || unchanged || pending || !hydrated}><Save size={14} aria-hidden="true" /></button>}
        overlay={<div className="portal-access-save-controls">
          <span aria-live="polite" title={updated ?? undefined}>{locked ? "Fixed access" : unchanged ? "Saved" : "Unsaved changes"}</span>
        </div>}
        renderCenterPanel={(canvasTools) => <>
          <p>Choose a role to manage its access.</p>
          {rolePicker}
          <div className="portal-access-center-actions">
            {canvasTools}
            {!locked && <button type="button" className="portal-button is-ghost" onClick={() => setOpen(defaults)} disabled={pending || atDefaults} title="Restore this level’s default access. Save to apply."><RotateCcw size={14} aria-hidden="true" /> Defaults</button>}
          </div>
        </>}
      />
      <dialog ref={securityDialog} className="portal-access-security-dialog" aria-labelledby={securityTitleId} aria-describedby={securityDescriptionId} onClose={() => setSecurityOpen(false)} onCancel={event => { if (pending) event.preventDefault(); }}>
        <LockOpenIcon className="portal-access-security-icon" size={28} loop={securityOpen} aria-hidden="true" />
        <small>High security notice</small>
        <h2 id={securityTitleId}>{confirmationStep ? "Authorize access changes" : "Confirm access changes"}</h2>
        <p id={securityDescriptionId}>{confirmationStep ? "Confirm your authorization to save these permissions." : <>You are changing permissions for <strong>{levelName}</strong>.</>}</p>
        {confirmationStep ? <div className="portal-access-security-confirmation">
          <label htmlFor={confirmationInputId}>To confirm, type &quot;<strong>{confirmationPhrase}</strong>&quot; in the box below:</label>
          <div className="portal-access-security-input">
            <input id={confirmationInputId} type={showConfirmation ? "text" : "password"} className="portal-input" ref={focusConfirmationInput} value={confirmationText} onChange={event => setConfirmationText(event.target.value)} disabled={pending} autoComplete="off" autoCapitalize="none" spellCheck={false} />
            <button type="button" className="portal-access-security-visibility" aria-label={showConfirmation ? "Hide confirmation text" : "Show confirmation text"} aria-pressed={showConfirmation} aria-controls={confirmationInputId} disabled={pending} onClick={() => setShowConfirmation(visible => !visible)}>{showConfirmation ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
          </div>
        </div> : <div className="portal-access-security-changes">
          {gained.length > 0 && <div><h3>Access granted</h3><p>{gained.map(tab => tab.label).join(", ")}</p></div>}
          {lost.length > 0 && <div><h3>Access removed</h3><p>{lost.map(tab => tab.label).join(", ")}</p></div>}
        </div>}
        <div className="portal-access-security-actions">
          <button type="button" className="portal-button is-ghost" autoFocus disabled={pending} onClick={() => securityDialog.current?.close()}>Cancel</button>
          {confirmationStep ? <button type="submit" className="portal-button" disabled={pending || !hydrated || confirmationText !== confirmationPhrase}>{pending ? <Busy>Saving</Busy> : "Execute"}</button> : <button type="button" className="portal-button" disabled={pending || !hydrated} onClick={() => setConfirmationStep(true)}>Authorize</button>}
        </div>
        <span className="sr-only" role="status">{pending ? "Saving access changes. Please wait." : ""}</span>
      </dialog>
    </form>
    </UnsavedAccessGuard>
  );
}

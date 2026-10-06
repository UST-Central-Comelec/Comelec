"use client";

import { useState } from "react";
import { Lock, RotateCcw } from "lucide-react";
import type { GroupLabel, TabKey } from "@/lib/portal/access";
import type { FormState } from "@/lib/portal/form";
import { useHydrated, usePortalForm } from "./portal-form";

/**
 * A tab as the form shows it. `fixed` can't be switched here: everything for the Central Executive
 * Board, the Central-only tabs for a level whose accounts are all Local, and the board's own tab
 * for every other level. `centralOnly` tabs hold commission-wide content, which a Local account
 * can't be given; a `boardOnly` tab is the Central Executive Board's alone.
 */
export type AccessTab = { key: TabKey; label: string; on: boolean; byDefault: boolean; fixed: boolean; centralOnly: boolean; boardOnly: boolean };
/** A main tab and its subtabs. The Dashboard has no main tab, so its `label` is null. */
export type AccessGroup = { label: GroupLabel | null; tabs: AccessTab[] };

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Stands in for the action where there's nothing to save. */
const noAction: FormAction = async () => undefined;

const sameSet = (a: ReadonlySet<TabKey>, b: ReadonlySet<TabKey>) => a.size === b.size && [...a].every((key) => b.has(key));

/** An on/off switch: a checkbox, announced as a switch. Sent with the form as `tab` when it's on. */
function Switch({ name, value, checked, mixed, disabled, onChange, label }: { name?: string; value?: string; checked: boolean; mixed?: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <span className={`portal-switch${mixed ? " is-mixed" : ""}`}>
      <input type="checkbox" role="switch" name={name} value={value} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <i aria-hidden="true" />
    </span>
  );
}

/**
 * Accounts → Access Control, for one level: a switch per tab, under its main tab, which has a switch of
 * its own for all of them at once. `action` is null for the Central Executive Board, whose access
 * is shown but can't be changed. Fixed tabs remain disabled and show a lock icon.
 */
export function AccessControlForm({ action, groups, updated }: { action: FormAction | null; groups: AccessGroup[]; updated: string | null }) {
  const { state, pending, onSubmit } = usePortalForm(action ?? noAction);
  const hydrated = useHydrated();
  const tabs = groups.flatMap((group) => group.tabs);
  const saved = new Set(tabs.filter((tab) => tab.on).map((tab) => tab.key));
  const defaults = new Set(tabs.filter((tab) => tab.byDefault).map((tab) => tab.key));
  const [open, setOpen] = useState<ReadonlySet<TabKey>>(saved);

  const unchanged = sameSet(open, saved);
  const atDefaults = sameSet(open, defaults);
  const locked = action === null;

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
    <form className="portal-settings-form" onSubmit={onSubmit} noValidate>
      <div className="portal-access">
        {groups.map((group) => {
          const free = group.tabs.filter((tab) => !tab.fixed);
          const on = group.tabs.filter((tab) => open.has(tab.key));
          const all = free.length > 0 && free.every((tab) => open.has(tab.key));
          const name = group.label ?? group.tabs[0].label;
          return (
            <div className={`portal-access-group${on.length ? " is-on" : ""}`} key={name} role="group" aria-label={name}>
              <div className="portal-access-main">
                <span className="portal-access-name">
                  <strong>{name}</strong>
                  {/* The Dashboard is one tab, so its switch says it all. */}

                </span>
                {group.label ? (
                  free.length > 0 ? (
                    <Switch checked={all} mixed={!all && on.length > 0} disabled={locked} onChange={(next) => set(free.map((tab) => tab.key), next)} label={`All of ${name}`} />
                  ) : (
                    <span className="portal-access-fixed" role="img" aria-label="Locked" title="Access is fixed for this level"><Lock size={14} aria-hidden="true" /></span>
                  )
                ) : (
                  <Switch name="tab" value={group.tabs[0].key} checked={open.has(group.tabs[0].key)} disabled={group.tabs[0].fixed} onChange={(next) => set([group.tabs[0].key], next)} label={name} />
                )}
              </div>
              {group.label && (
                <ul className="portal-access-tabs">
                  {group.tabs.map((tab) => (
                    <li key={tab.key} className={tab.fixed && !locked ? "is-fixed" : undefined}>
                      <label>
                        <Switch name="tab" value={tab.key} checked={open.has(tab.key)} disabled={tab.fixed} onChange={(next) => set([tab.key], next)} label={`${name}: ${tab.label}`} />
                        <span>{tab.label}</span>
                        {tab.fixed && <span className="portal-access-fixed" role="img" aria-label="Locked" title="Access is fixed for this level"><Lock size={12} aria-hidden="true" /></span>}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {!locked && (
        <footer className={`portal-settings-foot${unchanged ? "" : " is-dirty"}`}>
          {state?.error ? <p className="portal-form-error" role="alert">{state.error}</p> : <span className="portal-settings-dirty" aria-live="polite">{unchanged ? (updated ?? (atDefaults ? "On the default access" : "")) : "Unsaved changes"}</span>}
          <div className="portal-form-actions">
            <button type="button" className="portal-button is-ghost" onClick={() => setOpen(defaults)} disabled={pending || atDefaults} title="Switch every tab back to this level’s default access. Nothing is saved until you press Save."><RotateCcw size={15} aria-hidden="true" /> Defaults</button>
            {!unchanged && <button type="button" className="portal-button is-ghost" onClick={() => setOpen(saved)} disabled={pending}>Discard</button>}
            <button className="portal-button" type="submit" disabled={pending || !hydrated || unchanged}>{pending ? "Saving…" : unchanged ? "Saved" : "Save access"}</button>
          </div>
        </footer>
      )}
    </form>
  );
}

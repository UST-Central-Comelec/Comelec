"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import type { FormState } from "@/lib/portal/form";
import { isRequiredEmail, type EmailKey } from "@/lib/notifications/switches";
import { useHydrated, usePortalForm } from "./portal-form";

/** One automatic email as the list shows it: its name, where its preview is, and whether it's on. */
export type AutomaticItem = { key: EmailKey; name: string; href: string; on: boolean; byDefault: boolean; waiting: boolean };
export type AutomaticItemGroup = { label: string; emails: AutomaticItem[] };

type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;

/** Stands in for the action where there's nothing to save. */
const noAction: FormAction = async () => undefined;

const sameSet = (a: ReadonlySet<EmailKey>, b: ReadonlySet<EmailKey>) => a.size === b.size && [...a].every((key) => b.has(key));

/** The switches as they stand on the page, and as they're saved, for what's shown beside the list. */
const Switches = createContext<{ on: ReadonlySet<EmailKey>; saved: ReadonlySet<EmailKey> } | null>(null);

/** An on/off switch: a checkbox, announced as a switch. Sent with the form as `email` when it's on. */
function Switch({ name, value, checked, disabled, onChange, label }: { name: string; value: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <span className="portal-switch">
      <input type="checkbox" role="switch" name={name} value={value} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
      <i aria-hidden="true" />
    </span>
  );
}

/**
 * Apps → Email Sender → Automatic: every email the site sends by itself, under what it's about,
 * each with its switch beside its name. Picking a name shows that email in `children`, beside the
 * list, and the switches keep what was changed while another is looked at. Nothing is saved until Save. `action` is null for
 * whoever can't switch them: the switches show how each stands, and that's all.
 */
export function AutomaticEmails({ action, groups, current, local, updated, children }: { action: FormAction | null; groups: AutomaticItemGroup[]; current: EmailKey; local: boolean; updated: string | null; children: ReactNode }) {
  const { state, pending, onSubmit } = usePortalForm(action ?? noAction);
  const hydrated = useHydrated();
  const emails = groups.flatMap((group) => group.emails);
  const saved = new Set(emails.filter((email) => email.on).map((email) => email.key));
  const defaults = new Set(emails.filter((email) => email.byDefault).map((email) => email.key));
  const [on, setOn] = useState<ReadonlySet<EmailKey>>(saved);

  const unchanged = sameSet(on, saved);
  const atDefaults = sameSet(on, defaults);
  const locked = action === null;

  const set = (key: EmailKey, next: boolean) =>
    setOn((now) => {
      const changed = new Set(now);
      if (next) changed.add(key);
      else changed.delete(key);
      return changed;
    });

  return (
    <Switches value={{ on, saved }}>
      <div className="email-auto">
        <form className={`portal-card is-flush email-auto-list${locked ? " is-locked" : ""}`} onSubmit={onSubmit} noValidate>
          {/* Where the page comes back to once it's saved: the email that was being looked at. */}
          <input type="hidden" name="shown" value={current} />
          {local && <input type="hidden" name="unit" value="local" />}
          {/* Above the list, so what's unsaved and the button that saves it are in view wherever the list is scrolled to. */}
          <div className={`email-auto-bar${unchanged ? "" : " is-dirty"}`}>
            {state?.error && <p className="portal-form-error" role="alert">{state.error}</p>}
            <span className="portal-settings-dirty" aria-live="polite">{unchanged ? `${on.size} of ${emails.length} switched on` : "Unsaved changes"}</span>
            {!locked && (
              <div className="portal-form-actions">
                {unchanged ? (
                  !atDefaults && <button type="button" className="portal-button is-ghost is-small" onClick={() => setOn(defaults)} title="Put every switch back to how it starts. Nothing is saved until you press Save."><RotateCcw size={13} aria-hidden="true" /> Defaults</button>
                ) : (
                  <>
                    <button type="button" className="portal-button is-ghost is-small" onClick={() => setOn(saved)} disabled={pending}>Discard</button>
                    <button className="portal-button is-small" type="submit" disabled={pending || !hydrated}>{pending ? "Saving…" : "Save"}</button>
                  </>
                )}
              </div>
            )}
            {locked ? <small>Only the Central Executive Board and the Central Comelec’s official account switch these on and off.</small> : unchanged && updated && <small>{updated}</small>}
          </div>
          <nav className="email-auto-groups" aria-label="Automatic emails">
            {groups.map((group) => (
                <section key={group.label} role="group" aria-label={group.label}>
                  <h2>{group.label}</h2>
                  <ul>
                    {group.emails.map((email) => (
                      <li key={email.key} className={`${email.key === current ? "is-current" : ""}${on.has(email.key) ? "" : " is-off"}`}>
                        <Link href={email.href} scroll={false} aria-current={email.key === current ? "true" : undefined}>
                          {email.name}
                          {isRequiredEmail(email.key) && <small>Always sent</small>}
                          {email.waiting && <small>Not sending yet</small>}
                        </Link>
                        <Switch name="email" value={email.key} checked={on.has(email.key)} disabled={locked || isRequiredEmail(email.key)} onChange={(next) => set(email.key, next)} label={`${group.label}: ${email.name}`} />
                      </li>
                    ))}
                  </ul>
                </section>
            ))}
          </nav>

        </form>

        <div className="email-auto-main">{children}</div>
      </div>
    </Switches>
  );
}

/**
 * Whether the email being looked at is sent, as its switch stands on the page: it follows the
 * switch as it's flipped, and says so while that isn't saved.
 */
export function AutomaticStatus({ email, waiting }: { email: EmailKey; waiting: boolean }) {
  const switches = useContext(Switches);
  if (!switches) return null;
  const on = switches.on.has(email);

  return (
    <span className="email-auto-status">
      {on !== switches.saved.has(email) && <span className="portal-tag is-gold">Not saved yet</span>}
      {!on ? <span className="portal-tag is-warn">Switched off</span> : waiting ? <span className="portal-tag">Not sending yet</span> : <span className="portal-tag is-ok">Active</span>}
    </span>
  );
}

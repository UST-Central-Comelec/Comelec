"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

// Keeps a long form's answers on this device while it's being filled in, so a reload, a closed tab or
// a dropped connection doesn't mean starting again. Two parts are kept: the answers held in React
// state (the step, pickers, lists of rows), and every named field in the form as typed. On the way
// back the state is restored first, so the steps and rows it draws are there, then the fields are
// filled in through their own input events, so controlled fields see them too.
//
// Files can't be kept (the browser won't hand them back), nor passwords or hidden inputs, which
// mirror state.
//
// Like booking a ticket, each session is held for SESSION_MINUTES from when the form opens. A reload
// keeps the same session and its clock; when time's up the answers go and the form starts again.
// The form clears its own draft once it's sent.

const PREFIX = "form-draft:";
export const SESSION_MINUTES = 60;
const LIFETIME = SESSION_MINUTES * 60 * 1000;
const SKIPPED_TYPES = ["hidden", "file", "password", "submit", "button", "reset", "image"];

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
/** A field's name, which of the fields with that name it is, and its value (or whether it's ticked). */
type FieldEntry = [name: string, index: number, value: string | boolean];
type Stored<T> = { startedAt: number; savedAt: number; state: T; fields: FieldEntry[] };

function isField(element: Element): element is Field {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

/** Fields worth keeping: named, typed in by a person, and not a spam trap or marked to leave out. */
function kept(field: Field) {
  // Disabled fields count: a form disables its fields while sending, which is when a connection drops.
  if (!field.name) return false;
  if (field instanceof HTMLInputElement && SKIPPED_TYPES.includes(field.type)) return false;
  if (field instanceof HTMLSelectElement && field.multiple) return false;
  return !field.closest('[aria-hidden="true"], [data-draft="off"]');
}

/** Every named field, grouped by name in page order, so each can be found again by name and position. */
function fieldsByName(form: HTMLFormElement) {
  const groups = new Map<string, Field[]>();
  for (const element of Array.from(form.elements)) {
    if (!isField(element) || !element.name) continue;
    const group = groups.get(element.name) ?? [];
    group.push(element);
    groups.set(element.name, group);
  }
  return groups;
}

function readFields(form: HTMLFormElement): FieldEntry[] {
  const entries: FieldEntry[] = [];
  for (const [name, group] of fieldsByName(form)) {
    group.forEach((field, index) => {
      if (!kept(field)) return;
      const checkable = field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio");
      entries.push([name, index, checkable ? (field as HTMLInputElement).checked : field.value]);
    });
  }
  return entries;
}

/** Sets each field as if it were typed or ticked, so React and the form's own listeners all see it. */
function writeFields(form: HTMLFormElement, entries: FieldEntry[]) {
  const groups = fieldsByName(form);
  for (const [name, index, value] of entries) {
    const field = groups.get(name)?.[index];
    if (!field || !kept(field)) continue;
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
      // A radio is unticked by ticking another in its group.
      if (typeof value !== "boolean" || field.checked === value || (field.type === "radio" && !value)) continue;
      // Bypass React's value tracker so its onChange (which listens for clicks) sees the change.
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")?.set?.call(field, value);
      field.dispatchEvent(new Event("click", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
      continue;
    }
    if (typeof value !== "string" || field.value === value) continue;
    const prototype = field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(new Event(field instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  }
}

function load<T>(key: string): Stored<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored<T>;
    if (typeof stored?.startedAt === "number" && Date.now() - stored.startedAt < LIFETIME) return stored;
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage blocked or the draft unreadable: the form starts empty.
  }
  return null;
}

/** Removes every draft past its time, from any form. */
function sweep() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const name = localStorage.key(index);
      if (name?.startsWith(PREFIX)) load(name.slice(PREFIX.length));
    }
  } catch {
    // Nothing to tidy without storage.
  }
}

/** Forgets a draft by its key, for a form that is gone once it's sent. */
export function forgetFormDraft(key: string) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing was kept.
  }
}

export type FormDraft = {
  /** When the answers brought back were last saved, if any were. */
  restoredAt: number | null;
  /** When this session runs out, once the form is open and until it's sent. */
  endsAt: number | null;
  /** The session ran out: the answers are gone. */
  expired: boolean;
  /** Forgets the draft, for when the form has been sent. */
  clear: () => void;
  /** Forgets the draft and reloads the page, for an empty form. */
  startOver: () => void;
};

/**
 * Keeps a form's answers on this device for a session of SESSION_MINUTES from when it opens. `key` names the draft (null keeps nothing:
 * view mode, or once the form is sent); `state` is what the form holds in React state, and `restore`
 * puts it back. `onRestored` runs once the fields are filled in again. `carry` names the draft kept
 * before `key` was known (as before an account is verified): when `key` has none of its own, that one
 * is taken over, clock and all, so the session runs on instead of starting again.
 */
export function useFormDraft<T>({ key, carry, form, state, restore, onRestored }: {
  key: string | null;
  carry?: string | null;
  form: RefObject<HTMLFormElement | null>;
  state: T;
  restore: (state: T) => void;
  onRestored?: () => void;
}): FormDraft {
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [pending, setPending] = useState<FieldEntry[] | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const started = useRef<number | null>(null);
  const stateRef = useRef(state);
  const restoreRef = useRef(restore);
  const restoredRef = useRef(onRestored);
  const formRef = useRef(form);
  // Saving waits until the draft has been looked for, and until something has been filled in.
  const ready = useRef<string | null>(null);
  const touched = useRef(false);
  const cleared = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    stateRef.current = state;
    restoreRef.current = restore;
    restoredRef.current = onRestored;
    formRef.current = form;
  });

  const save = useCallback(() => {
    clearTimeout(timer.current);
    if (!key || ready.current !== key || !touched.current || cleared.current) return;
    const root = formRef.current.current;
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify({ startedAt: started.current ?? Date.now(), savedAt: Date.now(), state: stateRef.current, fields: root ? readFields(root) : [] } satisfies Stored<T>));
    } catch {
      // Storage full or blocked: the form still works, it just isn't kept.
    }
  }, [key]);

  const later = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(save, 400);
  }, [save]);

  // Look for a draft once per key: the key can arrive later, as when an applicant signs in.
  useEffect(() => {
    if (!key) return;
    sweep();
    cleared.current = false;
    let stored = load<T>(key);
    let carried = false;
    if (!stored && carry && carry !== key) {
      stored = load<T>(carry);
      carried = Boolean(stored);
      forgetFormDraft(carry);
    }
    ready.current = key;
    // The session's clock starts as the form opens, or carries on from the one brought back.
    started.current = stored?.startedAt ?? Date.now();
    setStartedAt(started.current);
    setExpired(false);
    if (!stored) return;
    // Carried over while the form is still open: what's on screen is newer, so only the clock goes on.
    if (carried && touched.current) {
      later();
      return;
    }
    touched.current = true;
    if (carried) later();
    restoreRef.current(stored.state);
    if (!carried) setRestoredAt(stored.savedAt);
    setPending(stored.fields);
    // `carry` is read only as the key arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, later]);

  // Time's up: the answers go, and the form has to be started again.
  useEffect(() => {
    if (!key || startedAt === null) return;
    const timeout = setTimeout(() => {
      clearTimeout(timer.current);
      cleared.current = true;
      forgetFormDraft(key);
      setExpired(true);
    }, Math.max(0, startedAt + LIFETIME - Date.now()));
    return () => clearTimeout(timeout);
  }, [key, startedAt]);

  // After the restored state has drawn its steps and rows, fill in the fields.
  useEffect(() => {
    if (!pending) return;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (form.current) writeFields(form.current, pending);
        setPending(null);
        restoredRef.current?.();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pending, form]);

  // Typing, ticking and picking: save shortly after.
  useEffect(() => {
    const root = form.current;
    if (!key || !root) return;
    const onEdit = (event: Event) => {
      if (!event.isTrusted) return;
      touched.current = true;
      later();
    };
    root.addEventListener("input", onEdit);
    root.addEventListener("change", onEdit);
    return () => {
      root.removeEventListener("input", onEdit);
      root.removeEventListener("change", onEdit);
    };
  }, [form, key, later]);

  // Answers held in state (pickers, steps, rows) change without a field event.
  const initial = useRef<string | null>(null);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const stamp = JSON.stringify(state);
    if (stamp === last.current) return;
    last.current = stamp;
    if (initial.current === null) initial.current = stamp;
    else if (stamp !== initial.current) touched.current = true;
    if (touched.current) later();
  }, [state, later]);

  // Leaving, reloading or switching away: save now, without waiting.
  useEffect(() => {
    const now = () => save();
    const hidden = () => { if (document.visibilityState === "hidden") save(); };
    window.addEventListener("pagehide", now);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", now);
      document.removeEventListener("visibilitychange", hidden);
      clearTimeout(timer.current);
    };
  }, [save]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    cleared.current = true;
    setRestoredAt(null);
    setStartedAt(null);
    if (key) forgetFormDraft(key);
  }, [key]);

  const startOver = useCallback(() => {
    clear();
    window.location.reload();
  }, [clear]);

  return { restoredAt, endsAt: startedAt === null ? null : startedAt + LIFETIME, expired, clear, startOver };
}

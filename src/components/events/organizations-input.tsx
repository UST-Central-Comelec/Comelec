"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { MAX_ORGANIZATIONS, ORGANIZATION_MAX_LENGTH } from "@/lib/events/options";

/**
 * The registration form's organizations: type a name and press Enter (or a comma) to add it as a
 * chip, as many as apply. Each chip is sent as `organizations`, and so is a name still being typed,
 * so one left in the box when the form is sent isn't lost.
 */
export function OrganizationsInput({ initial, labelledBy, describedBy, onChange }: { initial: string[]; labelledBy: string; describedBy?: string; onChange?: () => void }) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const full = items.length >= MAX_ORGANIZATIONS;

  /** Adds each name that's long enough and not already listed. Anything too short stays in the box to be finished. */
  const add = (names: string[]) => {
    const next = [...items];
    let rest = "";
    for (const raw of names) {
      const name = raw.trim().replace(/\s+/g, " ").slice(0, ORGANIZATION_MAX_LENGTH);
      if (!name) continue;
      if (name.length < 2) rest = name;
      else if (next.length < MAX_ORGANIZATIONS && !next.some((item) => item.toLowerCase() === name.toLowerCase())) next.push(name);
    }
    setDraft(rest);
    if (next.length !== items.length) {
      setItems(next);
      onChange?.();
    }
  };

  const remove = (name: string) => {
    setItems(items.filter((item) => item !== name));
    onChange?.();
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      // Enter adds the organization rather than sending the form.
      event.preventDefault();
      add([draft]);
    } else if (event.key === "Backspace" && !draft && items.length) {
      remove(items[items.length - 1]);
    }
  };

  return (
    // A click anywhere in the box lands in the text field, as in a plain input.
    <div className="ev-orgs" onClick={(event) => { if (event.target === event.currentTarget) inputRef.current?.focus(); }}>
      {items.map((item) => (
        <span className="ev-org" key={item}>
          <span>{item}</span>
          <input type="hidden" name="organizations" value={item} />
          <button type="button" onClick={() => remove(item)} aria-label={`Remove ${item}`}><X size={13} aria-hidden="true" /></button>
        </span>
      ))}
      <input
        ref={inputRef}
        name="organizations"
        value={draft}
        maxLength={ORGANIZATION_MAX_LENGTH}
        placeholder={full ? `That’s the most you can list (${MAX_ORGANIZATIONS})` : items.length ? "Add another" : "Type an organization, then press Enter"}
        autoComplete="off"
        enterKeyHint="done"
        disabled={full}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onChange={(event) => {
          // A comma ends a name, so a pasted list becomes one chip per organization.
          const value = event.target.value;
          if (value.includes(",")) add(value.split(","));
          else setDraft(value);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => add([draft])}
      />
    </div>
  );
}

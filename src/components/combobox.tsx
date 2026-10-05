"use client";

import { ChevronDown } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";

/**
 * Text input with a filtered dropdown: type to narrow the list, or open it and pick. Only a value
 * from `options` counts as chosen; it's sent through a hidden input named `name` (as `submitValue`
 * when the sent value differs from the label). `pickOnly` makes it a plain picker for short lists.
 */
export function Combobox({ name, options, value, submitValue, onChange, placeholder, invalid, disabled, pickOnly, describedBy, labelledBy, emptyText = "No match. Try another name." }: {
  name: string;
  options: readonly string[];
  value: string;
  submitValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  pickOnly?: boolean;
  describedBy?: string;
  /** Id of the visible label, when the combobox isn't inside a <label>. */
  labelledBy?: string;
  emptyText?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Opens upward when there isn't room for the list below, near the bottom of the page or the screen.
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = query.trim().toLowerCase();
  const matches = pickOnly || !search || query === value ? options : options.filter((option) => option.toLowerCase().includes(search));

  const choose = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
  };

  /** Shows the list, on whichever side of the input has room for it. */
  const show = () => {
    const box = rootRef.current?.getBoundingClientRect();
    if (box) {
      const below = window.innerHeight - box.bottom;
      setUp(below < 320 && box.top > below);
    }
    setOpen(true);
  };

  /** Opens the list on the current choice, so Enter keeps it rather than taking the first option. */
  const openList = () => {
    setActive(Math.max(matches.indexOf(value), 0));
    show();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (pickOnly && !open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      setActive(Math.max(options.indexOf(value), 0));
      show();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return show();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + matches.length) % Math.max(matches.length, 1));
    } else if ((event.key === "Enter" || (pickOnly && event.key === " ")) && open) {
      event.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`combobox${open ? " is-open" : ""}${open && up ? " is-up" : ""}${pickOnly ? " is-pick-only" : ""}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-labelledby={labelledBy}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        readOnly={pickOnly}
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          if (!open) show();
          const typed = next.trim().toLowerCase();
          const exact = options.find((option) => option.toLowerCase() === typed);
          // Typing a whole option chooses it, so Enter has to land on that option in the list about
          // to be shown (the full list once the text is the choice itself), not on the first one.
          const shown = !typed || next === exact ? options : options.filter((option) => option.toLowerCase().includes(typed));
          setActive(exact ? shown.indexOf(exact) : 0);
          onChange(exact ?? "");
        }}
        onFocus={() => { if (!pickOnly) openList(); }}
        onClick={() => (pickOnly && open ? setOpen(false) : openList())}
        onBlur={() => {
          setOpen(false);
          setQuery(value);
        }}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="combobox-toggle" tabIndex={-1} aria-label="Show all options" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (open) setOpen(false); else show(); inputRef.current?.focus(); }}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <input type="hidden" name={name} value={submitValue ?? value} />
      {open && (
        // data-lenis-prevent: the site's smooth scrolling (smooth-scroll.tsx) would otherwise take the wheel and scroll the page, not the list.
        <ul className="combobox-list" id={listId} role="listbox" data-lenis-prevent>
          {matches.length ? matches.map((option, index) => (
            <li
              key={option}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option === value}
              className={index === active ? "is-active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              {option}
            </li>
          )) : <li className="combobox-empty">{emptyText}</li>}
        </ul>
      )}
    </div>
  );
}

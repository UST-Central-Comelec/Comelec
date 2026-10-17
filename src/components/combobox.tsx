"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { filterCollegeOptions } from "@/lib/applications/options";

/**
 * Text input with a filtered dropdown: type to narrow the list, or open it and pick. Only a value
 * from `options` counts as chosen; it's sent through a hidden input named `name` (as `submitValue`
 * when the sent value differs from the label). `pickOnly` makes it a plain picker for short lists.
 * `freeText` makes the options suggestions: whatever is typed is the value, trimmed on leaving.
 */
export function Combobox({ name, options, value, submitValue, onChange, placeholder, invalid, required, disabled, pickOnly, freeText, describedBy, labelledBy, filterOptions, emptyText = "No match. Try another name." }: {
  name: string;
  options: readonly string[];
  value: string;
  submitValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Left empty, the form isn't sent (src/components/form-validation.tsx). */
  required?: boolean;
  disabled?: boolean;
  pickOnly?: boolean;
  freeText?: boolean;
  describedBy?: string;
  /** Id of the visible label, when the combobox isn't inside a <label>. */
  labelledBy?: string;
  emptyText?: string;
  filterOptions?: (options: readonly string[], query: string) => readonly string[];
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Opens upward when there isn't room for the list below, near the bottom of the page or the screen.
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const collegeField = name === "college" || name === "rsvp_college";
  const [collegePlaceholder, setCollegePlaceholder] = useState("Type or pick your College");

  useEffect(() => {
    if (!collegeField || query || disabled) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hints = ["Type or pick your College", "Example: CICS, Pharmacy, FOP"];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      if (motion.matches || document.hidden) {
        setCollegePlaceholder(hints[0]);
        return;
      }
      let hint = 0;
      let length = 0;
      let deleting = false;
      setCollegePlaceholder("");
      const step = () => {
        length += deleting ? -1 : 1;
        setCollegePlaceholder(hints[hint].slice(0, length));
        let delay = deleting ? 35 : 65;
        if (!deleting && length === hints[hint].length) {
          deleting = true;
          delay = 2000;
        } else if (deleting && length === 0) {
          hint = (hint + 1) % hints.length;
          deleting = false;
          delay = 300;
        }
        timer = setTimeout(step, delay);
      };
      timer = setTimeout(step, 300);
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [collegeField, query, disabled]);

  const search = query.trim().toLowerCase();
  const filter = (query: string) => (filterOptions ?? filterCollegeOptions)(options, query);
  const matches = pickOnly || !search || (!freeText && query === value) ? options : filter(search);

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

  const hasSelectedOption = options.includes(value) && query.trim().toLowerCase() === value.toLowerCase();
  const clearSelection = () => {
    setQuery("");
    onChange("");
    setActive(0);
    show();
  };
  const moveCaretToEnd = (input: HTMLInputElement) => {
    if (!pickOnly && input.value) input.setSelectionRange(input.value.length, input.value.length);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && hasSelectedOption && !event.nativeEvent.isComposing) {
      event.preventDefault();
      clearSelection();
    } else if (event.key === "Tab" && !event.shiftKey && open && !pickOnly) {
      // Commit the first search result and let Tab move focus normally. Keep an existing
      // selection when the field was only focused, without a new search.
      if (matches[0] && (query !== value || !options.includes(value))) choose(matches[0]);
    } else if (pickOnly && !open && (event.key === "Enter" || event.key === " ")) {
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
        placeholder={collegeField ? collegePlaceholder : placeholder}
        autoComplete="off"
        disabled={disabled}
        readOnly={pickOnly}
        onChange={(event) => {
          // Phone keyboards may send an input event without a Backspace keydown.
          const native = event.nativeEvent as InputEvent;
          if (hasSelectedOption && native.inputType === "deleteContentBackward" && !native.isComposing) {
            clearSelection();
            return;
          }
          const next = event.target.value;
          setQuery(next);
          if (!open) show();
          const typed = next.trim().toLowerCase();
          const exact = options.find((option) => option.toLowerCase() === typed);
          // Keep Enter on the exact match. Free-text fields still filter suggestions because their
          // value follows every keystroke, including text that isn't a suggested option.
          const shown = !typed || (!freeText && next === exact) ? options : filter(typed);
          setActive(exact ? shown.indexOf(exact) : 0);
          onChange(exact ?? (freeText ? next : ""));
        }}
        onFocus={(event) => {
          moveCaretToEnd(event.currentTarget);
          if (!pickOnly) openList();
        }}
        onClick={(event) => {
          moveCaretToEnd(event.currentTarget);
          if (pickOnly && open) setOpen(false);
          else openList();
        }}
        onBlur={() => {
          setOpen(false);
          const kept = freeText ? value.replace(/\s+/g, " ").trim() : value;
          if (kept !== value) onChange(kept);
          setQuery(kept);
        }}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="combobox-toggle" tabIndex={-1} aria-label="Show all options" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (open) setOpen(false); else show(); inputRef.current?.focus(); }}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <input type="hidden" name={name} value={submitValue ?? value} data-required={required || undefined} />
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

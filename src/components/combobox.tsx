"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";

/**
 * Text input with a filtered dropdown: type to narrow the list, or open it and pick. Only a value
 * from `options` counts as chosen; it's sent through a hidden input named `name`.
 */
export function Combobox({ name, options, value, onChange, placeholder, invalid, labelledBy, describedBy }: {
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  labelledBy?: string;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = query.trim().toLowerCase();
  const matches = !search || query === value ? options : options.filter((option) => option.toLowerCase().includes(search));

  const choose = (option: string) => {
    onChange(option);
    setQuery(option);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) return setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + matches.length) % Math.max(matches.length, 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={`combobox${open ? " is-open" : ""}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => {
          const next = event.target.value;
          setQuery(next);
          setOpen(true);
          setActive(0);
          const exact = options.find((option) => option.toLowerCase() === next.trim().toLowerCase());
          onChange(exact ?? "");
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(value);
        }}
        onKeyDown={onKeyDown}
      />
      <button type="button" className="combobox-toggle" tabIndex={-1} aria-label="Show all options" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(!open); inputRef.current?.focus(); }}>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <input type="hidden" name={name} value={value} />
      {open && (
        <ul className="combobox-list" id={listId} role="listbox">
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
              <span>{option}</span>
              {option === value && <Check size={15} strokeWidth={2.4} aria-hidden="true" />}
            </li>
          )) : <li className="combobox-empty">No match. Try another name.</li>}
        </ul>
      )}
    </div>
  );
}

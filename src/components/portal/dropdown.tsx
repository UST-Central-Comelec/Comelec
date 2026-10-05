"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";

/** `group` puts a heading over a run of options that share it. */
export type DropdownOption = { value: string; label: string; disabled?: boolean; group?: string };

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

/** How close the list may come to the edge of the window, and how far it sits from the button, in px. */
const EDGE = 12;
const GAP = 6;

/**
 * The portal's dropdown, in place of the browser's own `<select>`: a button that opens a list of
 * options, drawn in the portal's style. It's sent with a form through a hidden input named `name`.
 * Controlled with `value` and `onChange`, or left to itself with `defaultValue`.
 *
 * The list opens in the browser's top layer (a popover), so a table's scroll box, a card or a
 * dialog never cuts it off; it's placed under the button, or over it where there's more room.
 * Keys: Enter, Space or an arrow opens it; arrows, Home and End move; typing jumps to an option;
 * Enter or Space picks; Escape or Tab closes.
 *
 * `size="pill"` is the small rounded one for table rows and card headings.
 */
export function Dropdown({ name, options, value, defaultValue = "", onChange, placeholder = "Select", disabled, invalid, size = "field", label, labelledBy, className }: {
  name?: string;
  options: readonly DropdownOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  size?: "field" | "pill";
  /** What it's for, when there's no visible label to point at with `labelledBy`. */
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [own, setOwn] = useState(defaultValue);
  const chosen = value ?? own;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const selected = options.find((option) => option.value === chosen);
  const firstEnabled = options.findIndex((option) => !option.disabled);

  const close = () => setOpen(false);

  const show = () => {
    const box = button.current?.getBoundingClientRect();
    if (!box || disabled) return;
    // Under the button, unless there's more room over it.
    const below = window.innerHeight - box.bottom - GAP - EDGE;
    const above = box.top - GAP - EDGE;
    const up = below < 180 && above > below;
    const width = Math.max(box.width, 180);
    setPlace({
      left: Math.max(EDGE, Math.min(box.left, window.innerWidth - width - EDGE)),
      width,
      ...(up ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
      maxHeight: Math.min(320, Math.max(up ? above : below, 120)),
    });
    const current = options.findIndex((option) => option.value === chosen && !option.disabled);
    setActive(current === -1 ? firstEnabled : current);
    setOpen(true);
  };

  const pick = (option: DropdownOption) => {
    if (option.disabled) return;
    if (value === undefined) setOwn(option.value);
    onChange?.(option.value);
    close();
    button.current?.focus();
  };

  // The list lives in the top layer while it's open, and anything that moves the page under it closes it.
  useEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    element.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!element.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const moved = (event: Event) => {
      // Scrolling the list itself is fine.
      if (event.target instanceof Node && element.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", moved, true);
    window.addEventListener("resize", moved);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", moved, true);
      window.removeEventListener("resize", moved);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  /** The next option that can be picked, going `step` from `from` and wrapping round. */
  const move = (from: number, step: 1 | -1) => {
    for (let count = 0, index = from; count < options.length; count++) {
      index = (index + step + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return from;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const { key } = event;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        show();
      }
      return;
    }
    if (key === "Escape" || key === "Tab") {
      if (key === "Escape") event.preventDefault();
      close();
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => move(current, key === "ArrowDown" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? move(-1, 1) : move(options.length, -1));
    } else if (key === "Enter" || (key === " " && !(typed.current.text && Date.now() - typed.current.at <= 700))) {
      event.preventDefault();
      if (options[active]) pick(options[active]);
    } else if (key.length === 1) {
      // Typing jumps to the first option that starts with what's been typed in the last moment. A
      // space in the middle of typing is part of it ("College of S…"), not a pick.
      event.preventDefault();
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 700 ? key.toLowerCase() : typed.current.text + key.toLowerCase(), at: now };
      const match = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text));
      if (match !== -1) setActive(match);
    }
  };

  return (
    <span className={`portal-dropdown is-${size}${open ? " is-open" : ""}${invalid ? " is-invalid" : ""}${className ? ` ${className}` : ""}`}>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-label={label}
        aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          // Focus going to the list (a click on its scrollbar) keeps it open.
          if (!list.current?.contains(event.relatedTarget)) close();
        }}
      >
        <span id={`${id}-value`} className={selected ? undefined : "is-placeholder"}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={size === "pill" ? 13 : 16} strokeWidth={2} aria-hidden="true" />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={chosen} />}
      {open && place && (
        // Spans, so the dropdown can sit inside a <label> or a line of text; the stylesheet lays them out.
        <span
          ref={list}
          className={`portal-dropdown-list is-${size}`}
          id={listId}
          role="listbox"
          popover="manual"
          tabIndex={-1}
          style={{ left: place.left, top: place.top, bottom: place.bottom, minWidth: place.width, maxHeight: place.maxHeight }}
        >
          {options.map((option, index) => [
            option.group && option.group !== options[index - 1]?.group && <span key={`group-${option.group}`} className="portal-dropdown-group" role="presentation">{option.group}</span>,
            <span
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option.value === chosen}
              aria-disabled={option.disabled || undefined}
              data-active={index === active}
              // Keeps focus on the button, and stops a surrounding <label> from clicking it again.
              onPointerDown={(event) => event.preventDefault()}
              onPointerEnter={() => !option.disabled && setActive(index)}
              onClick={(event) => {
                event.preventDefault();
                pick(option);
              }}
            >
              <span>{option.label}</span>
              {option.value === chosen && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
            </span>,
          ])}
        </span>
      )}
    </span>
  );
}

/** Options from a record of value → label, as the option lists in src/lib are written. */
export const optionsOf = (labels: Readonly<Record<string, string>>): DropdownOption[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** Options whose value is the label itself. */
export const optionsFrom = (labels: readonly string[]): DropdownOption[] => labels.map((label) => ({ value: label, label }));

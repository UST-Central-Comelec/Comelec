"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { DropdownOption } from "./dropdown";

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

const EDGE = 12;
const GAP = 6;

/**
 * The portal's dropdown (dropdown.tsx) for picking several options: each one ticks on and off, and
 * the list stays open until it's closed. With nothing ticked the button shows `placeholder`, which
 * says what that means ("All units"); `clearLabel` at the top of the list unticks everything.
 * Keys: Enter, Space or an arrow opens it; arrows, Home and End move; typing jumps to an option;
 * Enter or Space ticks; Escape or Tab closes.
 */
export function MultiDropdown({ options, values, onChange, placeholder, clearLabel, disabled, invalid, labelledBy }: {
  options: readonly DropdownOption[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  clearLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
  labelledBy: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<Place | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const picked = options.filter((option) => values.includes(option.value));
  const summary = picked.length === 0 ? placeholder : picked.length === 1 ? picked[0].label : `${picked[0].label} +${picked.length - 1}`;

  const show = () => {
    const box = button.current?.getBoundingClientRect();
    if (!box || disabled) return;
    const below = window.innerHeight - box.bottom - GAP - EDGE;
    const above = box.top - GAP - EDGE;
    const up = below < 220 && above > below;
    const width = Math.max(box.width, 220);
    setPlace({
      left: Math.max(EDGE, Math.min(box.left, window.innerWidth - width - EDGE)),
      width,
      ...(up ? { bottom: window.innerHeight - box.top + GAP } : { top: box.bottom + GAP }),
      maxHeight: Math.min(340, Math.max(up ? above : below, 120)),
    });
    setActive(Math.max(0, options.findIndex((option) => values.includes(option.value) && !option.disabled)));
    setOpen(true);
  };

  const toggle = (option: DropdownOption) => {
    if (option.disabled) return;
    // Kept in the list's own order, whatever order they were ticked in.
    const next = values.includes(option.value) ? values.filter((value) => value !== option.value) : [...values, option.value];
    onChange(options.filter((item) => next.includes(item.value)).map((item) => item.value));
  };

  // The list lives in the top layer while it's open, and anything that moves the page under it closes it.
  useEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    if (typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!element.contains(target) && !button.current?.contains(target)) setOpen(false);
    };
    const moved = (event: Event) => {
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
      setOpen(false);
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => move(current, key === "ArrowDown" ? 1 : -1));
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? move(-1, 1) : move(options.length, -1));
    } else if (key === "Enter" || (key === " " && !(typed.current.text && Date.now() - typed.current.at <= 700))) {
      event.preventDefault();
      if (options[active]) toggle(options[active]);
    } else if (key.length === 1) {
      event.preventDefault();
      const now = Date.now();
      typed.current = { text: now - typed.current.at > 700 ? key.toLowerCase() : typed.current.text + key.toLowerCase(), at: now };
      const match = options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(typed.current.text));
      if (match !== -1) setActive(match);
    }
  };

  return (
    <span className={`portal-dropdown is-field${open ? " is-open" : ""}${invalid ? " is-invalid" : ""}`}>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-labelledby={`${labelledBy} ${id}-value`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!list.current?.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        <span id={`${id}-value`} className={picked.length ? undefined : "is-placeholder is-all"}>{summary}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      {open && place && (
        <span ref={list} className="portal-dropdown-list is-field is-multi" id={listId} role="listbox" aria-multiselectable="true" popover="manual" tabIndex={-1} style={{ left: place.left, top: place.top, bottom: place.bottom, minWidth: place.width, maxHeight: place.maxHeight }}>
          {clearLabel && (
            <span className="portal-dropdown-clear" role="presentation" aria-disabled={picked.length === 0 || undefined} onPointerDown={(event) => event.preventDefault()} onClick={() => onChange([])}>
              <span>{clearLabel}</span>
              {picked.length === 0 && <Check size={14} strokeWidth={2.2} aria-hidden="true" />}
            </span>
          )}
          {options.map((option, index) => [
            option.group && option.group !== options[index - 1]?.group && <span key={`group-${option.group}`} className="portal-dropdown-group" role="presentation">{option.group}</span>,
            <span
              key={option.value}
              id={`${id}-${index}`}
              role="option"
              aria-selected={values.includes(option.value)}
              aria-disabled={option.disabled || undefined}
              data-active={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onPointerEnter={() => !option.disabled && setActive(index)}
              onClick={(event) => {
                event.preventDefault();
                toggle(option);
              }}
            >
              <span>{option.label}</span>
              <i className="portal-dropdown-tick" aria-hidden="true">{values.includes(option.value) && <Check size={12} strokeWidth={3} />}</i>
            </span>,
          ])}
        </span>
      )}
    </span>
  );
}

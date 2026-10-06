"use client";

import { useState } from "react";
import { DatePicker } from "./date-picker";

/** Keeps Manila wall-clock form values while using the shared calendar for the date. */
export function DateTimePicker({ name, value, defaultValue = "", onChange, min, required, invalid, label }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  required?: boolean;
  invalid?: boolean;
  label: string;
}) {
  const [parts, setParts] = useState(() => ({ date: defaultValue.slice(0, 10), time: defaultValue.slice(11) }));
  const date = value === undefined ? parts.date : value.split("T")[0];
  const time = value === undefined ? parts.time : (value.split("T")[1] ?? "");
  const update = (nextDate: string, nextTime: string) => {
    setParts({ date: nextDate, time: nextTime });
    // Keep a partial controlled value so either field can be filled first.
    onChange?.(nextDate || nextTime ? `${nextDate}T${nextTime}` : "");
  };

  return <span className="portal-date-time">
    <DatePicker value={date} onChange={(next) => update(next, time)} min={min?.slice(0, 10)} required={required} invalid={invalid} label={`${label}: date`} />
    <input className="portal-input" type="time" value={time} onChange={(event) => update(date, event.target.value)} min={date === min?.slice(0, 10) ? min?.slice(11) : undefined} required={required} aria-invalid={invalid || undefined} aria-label={`${label}: time`} />
    {name && <input type="hidden" name={name} value={date && time ? `${date}T${time}` : ""} />}
  </span>;
}

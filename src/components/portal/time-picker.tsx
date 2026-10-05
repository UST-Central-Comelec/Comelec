"use client";

import { formatTime } from "@/lib/events/format";
import { TIME_STEP_MINUTES } from "@/lib/events/options";
import { Dropdown } from "./dropdown";

const timeOptions = Array.from({ length: 24 * 60 / TIME_STEP_MINUTES }, (_, index) => {
  const minutes = index * TIME_STEP_MINUTES;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { value, label: formatTime(value) };
});

/** The portal's standard dropdown, with times in five-minute steps and ISO form values. */
export function TimePicker({ name, value, defaultValue = "", onChange, optional, suggest, invalid, label, labelledBy }: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  optional?: boolean;
  suggest?: string;
  invalid?: boolean;
  label?: string;
  labelledBy?: string;
}) {
  // Put the suggested time first for an empty optional field, without assigning it until selected.
  const choices = optional && !(value ?? defaultValue) && suggest
    ? [...timeOptions.filter((option) => option.value === suggest), ...timeOptions.filter((option) => option.value !== suggest)]
    : timeOptions;
  return <Dropdown name={name} value={value} defaultValue={defaultValue} onChange={onChange} options={optional ? [{ value: "", label: "None" }, ...choices] : choices} placeholder={optional ? "None" : "Pick a time"} invalid={invalid} label={label} labelledBy={labelledBy} />;
}

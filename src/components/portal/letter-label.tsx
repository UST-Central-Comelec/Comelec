"use client";

import type { ToneItem } from "@/lib/letters/settings";
import { Dropdown } from "./dropdown";

/** Labels and their colours come from Secretariat → Settings. A label no longer listed shows in grey. */
export function LetterLabel({ labels, value, onChange, disabled, name }: { labels: ToneItem[]; value: string | null; onChange: (value: string | null) => void; disabled?: boolean; name?: string }) {
  const tone = value ? labels.find(label => label.name === value)?.tone ?? "grey" : "none";
  return <span className={`portal-letter-label is-tone-${tone}`}>
    <Dropdown name={name} value={value ?? ""} options={[{ value: "", label: "None" }, ...labels.map(label => ({ value: label.name, label: label.name }))]} size="pill" label={value ? `Change label: ${value}` : "Set letter label"} disabled={disabled} onChange={label => onChange(label || null)} />
  </span>;
}

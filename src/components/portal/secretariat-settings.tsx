"use client";

import { SaveIcon as ActionSaveIcon } from "@/components/action-icons";
import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Lock, LockOpen } from "lucide-react";
import { AddIcon as Plus, SearchIcon as Search, DeleteIcon as Trash2 } from "@/components/action-icons";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { destinationOffices } from "@/lib/letters/offices";
import { SECRETARIAT_RETURN } from "@/lib/portal/secretariat-return";
import { tones, toneLabels, type NamedItem, type RecordType, type SecretariatSettings, type ToneItem, type TrackerKind, type TrackerSettings } from "@/lib/letters/settings";
import { saveSecretariatSettings } from "@/lib/portal/secretariat-settings-actions";
import { toast } from "./toast";
import { useHydrated } from "./portal-form";
import { SlidingFilterButtons } from "./sliding-filters";
import "./letters-tracker.css";
import "./secretariat-settings.css";

export type Tab = "letters" | "minutes" | "labels" | "statuses" | "remarks" | "offices";
const tabItems: { key: Tab; label: string }[] = [
  { key: "letters", label: "Letters" },
  { key: "minutes", label: "Minutes of the Meetings" },
  { key: "labels", label: "Labels" },
  { key: "statuses", label: "Statuses" },
  { key: "remarks", label: "Remarks" },
  { key: "offices", label: "Destination Offices" },
];
/** The tab that shows the field a server error points at: "letters.types.3.format" → letters. */
const tabOf = (path: string): Tab => ({ letters: "letters", minutes: "minutes", labels: "labels", statuses: "statuses", remarkPresets: "remarks" } as const)[path.split(".")[0] as "letters"] ?? "letters";
const move = <Item,>(items: Item[], from: number, to: number) => {
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
const newId = () => crypto.randomUUID();

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: (on: boolean) => void; label: string }) {
  return <span className="portal-switch"><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} aria-label={label} /><i aria-hidden="true" /></span>;
}

function RowActions({ name, index, count, onMove, onRemove, removeDisabled, children }: { name: string; index: number; count: number; onMove?: (to: number) => void; onRemove: () => void; removeDisabled?: boolean; children?: ReactNode }) {
  const label = name || "this item";
  return <div className="sec-row-actions">
    {children}
    {onMove && <>
      <button type="button" className="portal-icon-button" aria-label={`Move ${label} up`} title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp size={15} aria-hidden="true" /></button>
      <button type="button" className="portal-icon-button" aria-label={`Move ${label} down`} title="Move down" disabled={index === count - 1} onClick={() => onMove(index + 1)}><ArrowDown size={15} aria-hidden="true" /></button>
    </>}
    <button type="button" className="portal-icon-button" aria-label={`Delete ${label}`} title={removeDisabled ? "Unlock to delete" : "Delete"} disabled={removeDisabled} onClick={onRemove}><Trash2 size={15} aria-hidden="true" /></button>
  </div>;
}

/** Formats are saved with {YYY} and {YYYY}, and shown and typed without the braces. */
const showFormat = (format: string) => format.replaceAll("{YYYY}", "YYYY").replaceAll("{YYY}", "YYY");
// Only bare letters become tokens, so showing what was saved gives back exactly what was typed and the cursor never jumps.
const saveFormat = (shown: string) => shown.replace(/YYYY|YYY/g, "{$&}");

/** A red part of an automatic format, with a tooltip saying what fills it in. */
function AutoPart({ children, tip }: { children: ReactNode; tip: ReactNode }) {
  return <span className="portal-info sec-auto-part">{children}<span className="portal-info-tip" role="tooltip">{tip}</span></span>;
}

/**
 * The format field. While the type auto-increments, the year letters and an example -000 show in
 * red over the typed text (a mirror behind a see-through input), each with a tooltip.
 */
function FormatInput({ value, counts, locked, universityIssued, invalid, describedBy, onChange }: { value: string; counts: boolean; locked: boolean; universityIssued: boolean; invalid: boolean; describedBy?: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const shown = showFormat(value);
  return <span className={`sec-format${counts && shown ? " is-auto" : ""}`}>
    <input ref={input} className={locked ? "is-fixed" : undefined} readOnly={locked} value={shown} maxLength={100} placeholder={universityIssued ? "Type the control number" : "UST:CC-YYY-LTR"} aria-invalid={invalid} aria-describedby={describedBy} onChange={event => onChange(saveFormat(event.target.value))} />
    {counts && shown && <span className="sec-format-mirror" aria-hidden="true" onMouseDown={event => {
      event.preventDefault();
      input.current?.focus();
      input.current?.setSelectionRange(shown.length, shown.length);
    }}>
      {shown.split(/(YYYY|YYY)/).map((part, index) => index % 2
        ? <AutoPart key={index} tip={<>Fills in the year when the number is given: {part === "YYY" ? "026 for 2026" : "2026"}.</>}>{part}</AutoPart>
        : part)}
      <AutoPart tip={<>Auto-increments (-001, -002, …) because <strong>Auto-increment</strong> is on.</>}>-000</AutoPart>
    </span>}
  </span>;
}

/** One letter or minutes type: its name and how its control number is made. University-issued types open locked. */
function TypeRow({ type, index, count, autoIncrement, locked, errors, path, onChange, onMove, onRemove, onLock }: {
  type: RecordType; index: number; count: number; autoIncrement: boolean; locked: boolean;
  errors: Record<string, string>; path: string; onChange: (type: RecordType) => void; onMove: (to: number) => void; onRemove: () => void; onLock: (locked: boolean) => void;
}) {
  const id = useId();
  const nameError = errors[`${path}.name`];
  const formatError = errors[`${path}.format`];
  // What the format was before University-issued was ticked, to bring back if it's unticked.
  const template = useRef(type.universityIssued ? "" : type.format);
  const counts = !type.universityIssued && autoIncrement && type.autoIncrement;
  return <li className={`sec-type${locked ? " is-locked" : ""}`}>
    <label className={`portal-field sec-type-name${nameError ? " has-error" : ""}`}>
      <span className="sec-type-label">Type</span>
      <input className={locked ? "is-fixed" : undefined} readOnly={locked} value={type.name} maxLength={100} placeholder="Type name" aria-invalid={Boolean(nameError)} aria-describedby={nameError ? `${id}-name` : undefined} autoFocus={!type.name} onChange={event => onChange({ ...type, name: event.target.value })} />
      {nameError && <span className="portal-field-error" id={`${id}-name`}>{nameError}</span>}
    </label>
    <label className={`portal-field sec-type-format${formatError ? " has-error" : ""}`}>
      <span className="sec-type-label">{type.universityIssued ? "University-issued number" : "Control number format"}</span>
      <FormatInput value={type.format} counts={counts} locked={locked} universityIssued={type.universityIssued} invalid={Boolean(formatError)} describedBy={formatError ? `${id}-format` : undefined} onChange={format => onChange({ ...type, format })} />
      {formatError && <span className="portal-field-error" id={`${id}-format`}>{formatError}</span>}
    </label>
    <div className="sec-type-checks" role="group" aria-label={`${type.name || "Type"} numbering`}>
      <label className="portal-letter-checkbox"><input type="checkbox" checked={type.universityIssued} disabled={locked} onChange={event => {
        // A university-issued number is typed in full, so the template is cleared.
        const issued = event.target.checked;
        if (issued) template.current = type.format;
        onChange({ ...type, universityIssued: issued, format: issued ? "" : template.current || type.format });
      }} /><span>University-issued</span></label>
      {/* Kept in place but invisible, so the row's height doesn't change. */}
      <label className={`portal-letter-checkbox${type.universityIssued ? " is-held" : ""}`} aria-hidden={type.universityIssued || undefined}><input type="checkbox" checked={type.autoIncrement} disabled={type.universityIssued} onChange={event => onChange({ ...type, autoIncrement: event.target.checked })} /><span>Auto-increment</span></label>
    </div>
    <RowActions name={type.name} index={index} count={count} onMove={onMove} onRemove={onRemove} removeDisabled={locked || count === 1}>
      {type.universityIssued && <button type="button" className={`portal-icon-button sec-lock${locked ? "" : " is-open"}`} aria-pressed={!locked} aria-label={locked ? `Unlock ${type.name} to edit` : `Lock ${type.name}`} title={locked ? "Unlock to edit" : "Lock"} onClick={() => onLock(!locked)}>{locked ? <Lock size={15} aria-hidden="true" /> : <LockOpen size={15} aria-hidden="true" />}</button>}
    </RowActions>
  </li>;
}

function TrackerPanel({ kind, tracker, errors, unlocked, onChange, onLock }: { kind: TrackerKind; tracker: TrackerSettings; errors: Record<string, string>; unlocked: Set<string>; onChange: (tracker: TrackerSettings) => void; onLock: (id: string, locked: boolean) => void }) {
  const noun = kind === "minutes" ? "meeting minutes" : "letter";
  const id = useId();
  const listError = errors[`${kind}.types`];
  return <>
    <div className="portal-setting">
      <div className="portal-setting-label"><span id={`${id}-auto`}>Auto-increment control numbers</span></div>
      <div className="portal-setting-control">
        <div className="portal-setting-inline"><Switch checked={tracker.autoIncrement} label="Auto-increment control numbers" onChange={on => onChange({ ...tracker, autoIncrement: on })} /><span>{tracker.autoIncrement ? "On" : "Off"}</span></div>
        <p className="portal-muted">{tracker.autoIncrement
          ? `Each ${noun} type that auto-increments gets the next number of its format, ending in -001, -002, … University-issued numbers fill in on their own.`
          : `Whoever adds a ${noun} types its control number. University-issued numbers still fill in on their own. Numbers already given are kept.`}</p>
      </div>
    </div>
    <div className="portal-setting">
      <div className="portal-setting-label"><span>{kind === "minutes" ? "Minutes types" : "Letter types"}</span></div>
      <div className="portal-setting-control">
        <ul className="portal-muted sec-type-guide">
          <li>New {kind === "minutes" ? "meeting minutes" : "letters"} use the first type in the list by default.</li>
          <li>Use <strong>YYY</strong> for the year’s last three digits (026 for 2026), or <strong>YYYY</strong> for the full year (2026).</li>
          <li>Parts in red fill in on their own. Hover over them to see how.</li>
          <li>Auto-increment adds -001, -002, … to the format. Types with the same format share the same counter.</li>
          <li>University-issued numbers are locked. Click the lock icon to edit one.</li>
          <li>Renaming a type updates its name on all existing {kind === "minutes" ? "meeting minutes" : "letters"}.</li>
          <li>You can’t delete a type while any {noun} still uses it.</li>
          <li>Changing a format keeps the control numbers already assigned.</li>
        </ul>
        {listError && <p className="portal-field-error">{listError}</p>}
        <div className="sec-types-head" aria-hidden="true"><span>Type</span><span>Control number</span><span>Numbering</span></div>
        <ol className="sec-types">
          {tracker.types.map((type, index) => <TypeRow key={type.id} type={type} index={index} count={tracker.types.length} autoIncrement={tracker.autoIncrement} locked={type.universityIssued && !unlocked.has(type.id)} errors={errors} path={`${kind}.types.${index}`}
            onChange={next => {
              // A type just made university-issued stays open for its number to be typed.
              if (next.universityIssued && !type.universityIssued) onLock(type.id, false);
              onChange({ ...tracker, types: tracker.types.map(item => item.id === type.id ? next : item) });
            }}
            onMove={to => onChange({ ...tracker, types: move(tracker.types, index, to) })}
            onRemove={() => onChange({ ...tracker, types: tracker.types.filter(item => item.id !== type.id) })}
            onLock={locked => onLock(type.id, locked)} />)}
        </ol>
        <div><button type="button" className="portal-button is-small is-ghost" disabled={tracker.types.length >= 50} onClick={() => {
          const added = { id: newId(), name: "", format: kind === "minutes" ? "UST:CC-{YYY}-MIN" : "UST:CC-{YYY}-LTR", autoIncrement: true, universityIssued: false };
          onLock(added.id, false);
          onChange({ ...tracker, types: [...tracker.types, added] });
        }}><Plus size={14} aria-hidden="true" />Add type</button></div>
      </div>
    </div>
  </>;
}

/** Destination offices: the Database's list, shown here read-only so the two always match. */
function OfficesPanel({ readOnly }: { readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = destinationOffices.filter(name => terms.every(term => name.toLowerCase().includes(term)));
  const count = destinationOffices.length;
  return <div className="portal-setting">
    <div className="portal-setting-label"><span>Destination offices</span></div>
    <div className="portal-setting-control">
      <div className={`sec-list-tools${readOnly ? " is-search-only" : " has-button"}`}>
        <span className="portal-setting-count" role="status">{terms.length ? `${shown.length} of ${count}` : `${count} ${count === 1 ? "office" : "offices"}`}</span>
        <label className="portal-search sec-list-search">
          <span className="portal-visually-hidden">Search destination offices</span>
          <Search size={15} aria-hidden="true" />
          <input className="portal-input" type="search" value={query} placeholder="Search destination offices" onChange={event => setQuery(event.target.value)} />
        </label>
        {!readOnly && <Link className="portal-button is-ghost" href={`/portal/database/offices?from=${SECRETARIAT_RETURN}`} title="Offices are added in Administrative → Database"><Plus size={15} aria-hidden="true" />Add office</Link>}
      </div>
      {shown.length ? <ul className="sec-offices">{shown.map(name => <li key={name}>{name}</li>)}</ul>
        : <p className="portal-empty">{count ? "No office matches." : "No offices yet."}</p>}
    </div>
  </div>;
}

/** Labels, statuses and remark presets: named items, some with a colour and an order. */
function ListPanel<Item extends NamedItem | ToneItem>({ title, items, path, errors, noun, ordered, preview, onChange }: {
  title: string; items: Item[]; path: string; errors: Record<string, string>; noun: string;
  ordered?: boolean; preview?: (item: ToneItem) => ReactNode; onChange: (items: Item[]) => void;
}) {
  const id = useId();
  const listError = errors[path];
  return <div className="portal-setting">
    <div className="portal-setting-label"><span>{title}</span></div>
    <div className="portal-setting-control">
      {listError && <p className="portal-field-error">{listError}</p>}
      {items.length === 0 && <p className="portal-empty">No {noun}s yet.</p>}
      <ol className="sec-list">
        {items.map((item, index) => {
          const error = errors[`${path}.${index}.name`];
          const toned = "tone" in item ? item as ToneItem : null;
          return <li key={item.id} className={`sec-list-item${toned ? " has-tone" : ""}`}>
            <div className={`portal-field sec-list-name${error ? " has-error" : ""}`}>
              <input value={item.name} maxLength={100} placeholder={`${noun[0].toUpperCase()}${noun.slice(1)} name`} aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} ${index + 1} name`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-${item.id}` : undefined} autoFocus={!item.name} onChange={event => onChange(items.map(other => other.id === item.id ? { ...other, name: event.target.value } : other))} />
              {error && <span className="portal-field-error" id={`${id}-${item.id}`}>{error}</span>}
            </div>
            {toned && <div className="sec-tones" role="radiogroup" aria-label={`${item.name || noun} colour`}>
              {tones.map(tone => <label key={tone} className={`sec-tone is-tone-${tone}`} title={toneLabels[tone]}>
                <input type="radio" name={`${id}-${item.id}-tone`} value={tone} checked={toned.tone === tone} onChange={() => onChange(items.map(other => other.id === item.id ? { ...other, tone } : other))} />
                <span className="portal-visually-hidden">{toneLabels[tone]}</span>
              </label>)}
            </div>}
            {toned && preview && <span className="sec-list-preview" aria-hidden="true">{preview(toned)}</span>}
            <RowActions name={item.name} index={index} count={items.length} onMove={ordered ? to => onChange(move(items, index, to)) : undefined} onRemove={() => onChange(items.filter(other => other.id !== item.id))} />
          </li>;
        })}
      </ol>
    </div>
  </div>;
}

export function SecretariatSettingsForm({ initial, updatedAt: initialUpdatedAt, readOnly, initialTab = "letters" }: { initial: SecretariatSettings; updatedAt: string | null; readOnly: boolean; initialTab?: Tab }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [unlocked, setUnlocked] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const edit = <Key extends keyof SecretariatSettings>(key: Key, value: SecretariatSettings[Key]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setErrors({});
  };
  const lock = (id: string, locked: boolean) => setUnlocked(previous => {
    const next = new Set(previous);
    if (locked) next.delete(id); else next.add(id);
    return next;
  });
  function discard() {
    setDraft(saved);
    setErrors({});
    setUnlocked(new Set());
  }
  function save() {
    if (readOnly || pending || !dirty) return;
    startTransition(async () => {
      try {
        const result = await saveSecretariatSettings(updatedAt, draft);
        if (!result.settings) {
          toast(result.error, "error");
          setErrors(result.fieldErrors ?? {});
          const first = Object.keys(result.fieldErrors ?? {})[0];
          if (first) setTab(tabOf(first));
          return;
        }
        setSaved(result.settings);
        setDraft(result.settings);
        setUpdatedAt(result.updatedAt);
        setUnlocked(new Set());
        toast("Settings saved.");
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t save the settings. Try again.", "error");
      }
    });
  }

  const statusPreview = (item: ToneItem) => <span className={`portal-letter-status is-tone-${item.tone}`}><span className="portal-letter-status-dot" />{item.name || "Status"}</span>;
  const labelPreview = (item: ToneItem) => <span className={`sec-label-preview is-tone-${item.tone}`}>{item.name || "Label"}</span>;
  const tabErrors = new Set(Object.keys(errors).map(tabOf));
  const addItem = {
    labels: { label: "Add label", full: draft.labels.length >= 20, add: () => edit("labels", [...draft.labels, { id: newId(), name: "", tone: "blue" }]) },
    statuses: { label: "Add status", full: draft.statuses.length >= 20, add: () => edit("statuses", [...draft.statuses, { id: newId(), name: "", tone: "grey" }]) },
    remarks: { label: "Add remark", full: draft.remarkPresets.length >= 30, add: () => edit("remarkPresets", [...draft.remarkPresets, { id: newId(), name: "" }]) },
  };
  const activeAdd = tab === "letters" || tab === "minutes" || tab === "offices" ? null : addItem[tab];

  return <>
    <SlidingFilterButtons items={tabItems.map(item => ({ key: item.key, label: tabErrors.has(item.key) ? <>{item.label}<span className="sec-tab-error" aria-hidden="true" /><span className="portal-visually-hidden"> (needs attention)</span></> : item.label }))} active={tab} label="Settings section" onChange={setTab} />
    <section className="portal-card portal-settings sec-settings" aria-label={tabItems.find(item => item.key === tab)?.label}>
      <form className="portal-settings-form" noValidate onSubmit={event => { event.preventDefault(); save(); }}>
        <fieldset className="sec-settings-fields" disabled={readOnly || pending}>
          {tab === "letters" && <TrackerPanel kind="letters" tracker={draft.letters} errors={errors} unlocked={unlocked} onLock={lock} onChange={tracker => edit("letters", tracker)} />}
          {tab === "minutes" && <TrackerPanel kind="minutes" tracker={draft.minutes} errors={errors} unlocked={unlocked} onLock={lock} onChange={tracker => edit("minutes", tracker)} />}
          {tab === "labels" && <ListPanel title="Labels" noun="label" path="labels" items={draft.labels} errors={errors} ordered preview={labelPreview}
            onChange={items => edit("labels", items)} />}
          {tab === "statuses" && <ListPanel title="Statuses" noun="status" path="statuses" items={draft.statuses} errors={errors} ordered preview={statusPreview}
            onChange={items => edit("statuses", items)} />}
          {tab === "remarks" && <ListPanel title="Remark presets" noun="remark" path="remarkPresets" items={draft.remarkPresets} errors={errors} ordered
            onChange={items => edit("remarkPresets", items)} />}
        </fieldset>
        {/* Outside the fieldset, so searching works for view-only readers too. */}
        {tab === "offices" && <OfficesPanel readOnly={readOnly} />}
        {!readOnly && <footer className={`portal-settings-foot${dirty ? " is-dirty" : ""}`}>
          <span className="portal-settings-dirty" aria-live="polite">{dirty ? "Unsaved changes" : ""}</span>
          <div className="portal-form-actions">
            {dirty && <button className="portal-button is-ghost" type="button" onClick={discard} disabled={pending}>Discard</button>}
            {activeAdd && <button className="portal-button is-ghost" type="button" disabled={pending || !hydrated || activeAdd.full} onClick={activeAdd.add}><Plus size={15} aria-hidden="true" />{activeAdd.label}</button>}
            <button className="portal-button" type="submit" disabled={pending || !hydrated || !dirty}><ActionSaveIcon size={15} aria-hidden="true" />{pending ? "Saving…" : dirty ? "Save settings" : "Saved"}</button>
          </div>
        </footer>}
      </form>
    </section>
  </>;
}

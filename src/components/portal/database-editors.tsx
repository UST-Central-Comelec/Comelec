"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Lock } from "lucide-react";
import { AddIcon as Plus, DeleteIcon as Trash2, SaveIcon, SearchIcon as Search } from "@/components/action-icons";
import type { AccountPosition } from "@/lib/data/types";
import { fixedPositions, type CollegeEntry, type CustomRole, type ProgramEntry, type ReferenceData, type UnitPosition } from "@/lib/reference/data";
import { saveDatabaseSection } from "@/lib/portal/database-actions";
import { saveElectivePositionsAction } from "@/lib/candidacy/positions-actions";
import type { ElectivePosition } from "@/lib/candidacy/positions";
import { DatabaseCollegeSearch } from "./database-college-search";
import { Dropdown } from "./dropdown";
import { InfoTip } from "./info-tip";
import { useHydrated } from "./portal-form";
import { toast } from "./toast";
import "./secretariat-settings.css";
import "./database.css";
import { Busy } from "@/components/busy";

type Errors = Record<string, string>;

const newKey = () => crypto.randomUUID();
const move = <Item,>(items: Item[], from: number, to: number) => {
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
};
const matches = (query: string, ...texts: string[]) => {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = texts.join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
};
const count = (total: number, noun: string, plural = `${noun}s`) => `${total} ${total === 1 ? noun : plural}`;

/**
 * One section's draft, and saving it over the version this page opened. After a save the page is
 * refreshed, so the lists every form reads are the saved ones from here on.
 */
function useSection<Draft>(section: string, initial: Draft, initialStamp: string | null, fromData: (data: ReferenceData) => Draft) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [stamp, setStamp] = useState(initialStamp);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  /** Saves the draft without a success message; reports a failure itself. */
  const commit = async (value: unknown) => {
    try {
      const result = await saveDatabaseSection(section, stamp, value);
      if (!result.data) {
        toast(result.error, "error");
        setErrors(result.fieldErrors ?? {});
        return false;
      }
      const next = fromData(result.data);
      setSaved(next);
      setDraft(next);
      setStamp(result.data.stamps[section] ?? null);
      return true;
    } catch (error) {
      unstable_rethrow(error);
      toast("Couldn’t save the list. Try again.", "error");
      return false;
    }
  };
  return {
    draft, errors, pending, hydrated, dirty,
    edit(next: Draft) {
      setDraft(next);
      setErrors({});
    },
    discard() {
      setDraft(saved);
      setErrors({});
    },
    commit,
    save(value: unknown, message: string) {
      if (pending || !dirty) return;
      startTransition(async () => {
        if (!(await commit(value))) return;
        toast(message);
        router.refresh();
      });
    },
  };
}

type Section<Draft> = ReturnType<typeof useSection<Draft>>;
type PanelState = Pick<Section<unknown>, "pending" | "hydrated" | "dirty" | "discard">;

/** The card a list sits in, with its title, search and the footer that saves it. */
/** How a list's body comes in: opening under its picker for the first time, or swapping for another unit's. */
type Reveal = "expand" | "fade";

function Panel({ title, info, state, readOnly, onSave, picker, tools, addLabel, onAdd, addDisabled, reveal, children }: {
  title: string; info: ReactNode; state: PanelState; readOnly: boolean; onSave: () => void; reveal?: Reveal;
  /** Which unit's list this is, chosen in the card's own header. */
  picker?: ReactNode; tools?: ReactNode; addLabel?: string; onAdd?: () => void; addDisabled?: boolean; children: ReactNode;
}) {
  const titleId = useId();
  const { pending, hydrated, dirty } = state;
  return (
    <section className="portal-card portal-settings sec-settings db-settings" aria-labelledby={titleId}>
      <form className="portal-settings-form" noValidate onSubmit={(event) => { event.preventDefault(); if (!readOnly) onSave(); }}>
        <div className="db-panel-head">
          <h2 className="db-panel-title" id={titleId}>{title}<InfoTip label={`About ${title}`}>{info}</InfoTip></h2>
          {picker}
          {tools}
        </div>
        <div className={`db-body${reveal ? ` is-${reveal}` : ""}`}><div>
        <fieldset className="sec-settings-fields db-fields" disabled={readOnly || pending}>{children}</fieldset>
        {!readOnly && <footer className={`portal-settings-foot${dirty ? " is-dirty" : ""}`}>
          <span className="portal-settings-dirty" aria-live="polite">{dirty ? "Unsaved changes" : ""}</span>
          <div className="portal-form-actions">
            {dirty && <button className="portal-button is-ghost" type="button" onClick={state.discard} disabled={pending}>Discard</button>}
            {onAdd && addLabel && <button className="portal-button is-ghost" type="button" disabled={pending || !hydrated || addDisabled} onClick={onAdd}><Plus size={15} aria-hidden="true" />{addLabel}</button>}
            <button className="portal-button" type="submit" disabled={pending || !hydrated || !dirty}><SaveIcon size={15} aria-hidden="true" />{pending ? <Busy>Saving</Busy> : dirty ? "Save list" : "Saved"}</button>
          </div>
        </footer>}
        </div></div>
      </form>
    </section>
  );
}

function SearchBox({ label, value, onChange, shown, total, noun }: { label: string; value: string; onChange: (value: string) => void; shown: number; total: number; noun: string }) {
  return (
    <div className="db-tools">
      <span className="portal-setting-count" role="status">{value.trim() ? `${shown} of ${total}` : count(total, noun)}</span>
      <label className="portal-search db-search">
        <span className="portal-visually-hidden">{label}</span>
        <Search size={15} aria-hidden="true" />
        <input className="portal-input" type="search" value={value} placeholder={label} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

function RowActions({ name, index, total, onMove, onRemove, fixed }: { name: string; index: number; total: number; onMove?: (to: number) => void; onRemove: () => void; fixed?: string }) {
  const label = name || "this item";
  return (
    <div className="sec-row-actions">
      {fixed && <span className="db-fixed"><InfoTip label={`Why ${label} is kept`} icon={<Lock size={14} aria-hidden="true" />}>{fixed}</InfoTip></span>}
      {onMove && <>
        <button type="button" className="portal-icon-button" aria-label={`Move ${label} up`} title="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp size={15} aria-hidden="true" /></button>
        <button type="button" className="portal-icon-button" aria-label={`Move ${label} down`} title="Move down" disabled={index === total - 1} onClick={() => onMove(index + 1)}><ArrowDown size={15} aria-hidden="true" /></button>
      </>}
      <button type="button" className="portal-icon-button" aria-label={`Delete ${label}`} title={fixed ? "Can’t be deleted" : "Delete"} disabled={Boolean(fixed)} onClick={onRemove}><Trash2 size={15} aria-hidden="true" /></button>
    </div>
  );
}

/** A text input with its error under it; `label` names it for screen readers and the form check. */
function TextCell({ value, label, error, readOnly, maxLength, placeholder, autoFocus, onChange, className = "" }: {
  value: string; label: string; error?: string; readOnly?: boolean; maxLength: number; placeholder?: string; autoFocus?: boolean; onChange: (value: string) => void; className?: string;
}) {
  const id = useId();
  return (
    <div className={`portal-field db-cell ${className}${error ? " has-error" : ""}`}>
      <input className={readOnly ? "is-fixed" : undefined} readOnly={readOnly} value={value} maxLength={maxLength} placeholder={placeholder} aria-label={label} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} autoFocus={autoFocus} onChange={(event) => onChange(event.target.value)} />
      {error && <span className="portal-field-error" id={`${id}-error`}>{error}</span>}
    </div>
  );
}

// ——— Colleges & Faculties ———

type CollegeRow = { key: string; name: string; abbreviation: string; aliases: string; comelec: boolean; saved: boolean };
const collegeRows = (colleges: CollegeEntry[]): CollegeRow[] => colleges.map((college) => ({ key: college.name, name: college.name, abbreviation: college.abbreviation, aliases: college.aliases.join(", "), comelec: college.comelec, saved: true }));
const collegeEntries = (rows: CollegeRow[]): CollegeEntry[] => rows.map((row) => ({ name: row.name, abbreviation: row.abbreviation, aliases: row.aliases.split(",").map((alias) => alias.trim()).filter(Boolean), comelec: row.comelec }));

export function CollegesEditor({ initial, stamp, readOnly }: { initial: CollegeEntry[]; stamp: string | null; readOnly: boolean }) {
  const state = useSection("colleges", collegeRows(initial), stamp, (data) => collegeRows(data.colleges));
  const [query, setQuery] = useState("");
  const rows = state.draft;
  const shown = rows.map((row, index) => ({ row, index })).filter(({ row }) => matches(query, row.name, row.abbreviation, row.aliases));
  const update = (key: string, change: Partial<CollegeRow>) => state.edit(rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  const add = () => {
    setQuery("");
    state.edit([{ key: newKey(), name: "", abbreviation: "", aliases: "", comelec: true, saved: false }, ...rows]);
  };
  return (
    <Panel title="Colleges & Faculties" state={state} readOnly={readOnly} onSave={() => state.save(collegeEntries(rows), "Colleges and faculties saved. Every college picker now lists them.")}
      addLabel="Add college" onAdd={add} addDisabled={rows.length >= 80}
      info={<>Every academic unit. Those with a <strong>Local Comelec</strong> are what students pick on the Apply, Request access and event forms, and each has its own positions, recruitment and accounts. The abbreviation is what lists show; other names help search and appear in letter destinations.</>}
      tools={<SearchBox label="Search colleges and faculties" value={query} onChange={setQuery} shown={shown.length} total={rows.length} noun="college" />}>
      {state.errors[""] && <p className="portal-field-error">{state.errors[""]}</p>}
      <div className="db-grid-head db-college-row" aria-hidden="true">
        <span>Name<InfoTip label="About names">A saved name can’t be changed: applications, accounts and events keep the name they were saved with. To rename one, add it under its new name, then delete the old one once no account uses it.</InfoTip></span>
        <span>Abbreviation</span><span>Other names</span><span>Local Comelec</span><span />
      </div>
      {shown.length === 0 && <p className="portal-empty">{rows.length ? "No college or faculty matches your search." : "No colleges or faculties yet."}</p>}
      <ol className="db-rows">
        {shown.map(({ row, index }) => (
          <li key={row.key} className="db-row db-college-row">
            <TextCell value={row.name} label={`College ${index + 1} name`} readOnly={row.saved} maxLength={120} placeholder="College of …" autoFocus={!row.saved && !row.name} error={state.errors[`${index}.name`]} onChange={(name) => update(row.key, { name })} />
            <TextCell value={row.abbreviation} label={`${row.name || "College"} abbreviation`} maxLength={20} placeholder="CICS" error={state.errors[`${index}.abbreviation`]} onChange={(abbreviation) => update(row.key, { abbreviation })} />
            <TextCell value={row.aliases} label={`${row.name || "College"} other names, separated by commas`} maxLength={200} placeholder="Separate with commas" error={state.errors[`${index}.aliases`] ?? state.errors[`${index}.aliases.0`]} onChange={(aliases) => update(row.key, { aliases })} />
            <label className="db-check"><input type="checkbox" checked={row.comelec} onChange={(event) => update(row.key, { comelec: event.target.checked })} /><span>Has one</span></label>
            <RowActions name={row.name} index={index} total={rows.length} onRemove={() => state.edit(rows.filter((item) => item.key !== row.key))} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

// ——— Programs & Majors, Admin Offices ———

type NameRow = { key: string; name: string };
const nameRows = (names: readonly string[]): NameRow[] => names.map((name, index) => ({ key: `${index}:${name}`, name }));

/** A plain list of names in order: the university's offices. */
export function NamesEditor({ picker, reveal, title, info, noun, plural, initial, stamp, readOnly, maxLength, savedMessage, empty }: {
  picker?: ReactNode; reveal?: Reveal; title: string; info: ReactNode; noun: string; plural?: string; initial: string[]; stamp: string | null; readOnly: boolean;
  maxLength: number; savedMessage: string; empty: string;
}) {
  const section = "offices";
  const state = useSection(section, nameRows(initial), stamp, (data) => nameRows(data.offices));
  const [query, setQuery] = useState("");
  const rows = state.draft;
  const searching = Boolean(query.trim());
  const shown = rows.map((row, index) => ({ row, index })).filter(({ row }) => matches(query, row.name));
  const add = () => {
    setQuery("");
    state.edit([...rows, { key: newKey(), name: "" }]);
  };
  const capital = `${noun[0].toUpperCase()}${noun.slice(1)}`;
  return (
    <Panel title={title} info={info} picker={picker} reveal={reveal} state={state} readOnly={readOnly} onSave={() => state.save(rows.map((row) => row.name), savedMessage)}
      addLabel={`Add ${noun}`} onAdd={add} addDisabled={rows.length >= 500}
      tools={<SearchBox label={`Search ${plural ?? `${noun}s`}`} value={query} onChange={setQuery} shown={shown.length} total={rows.length} noun={noun} />}>
      {state.errors[""] && <p className="portal-field-error">{state.errors[""]}</p>}
      {shown.length === 0 && <p className="portal-empty">{rows.length ? `No ${noun} matches your search.` : empty}</p>}
      <ol className="db-rows">
        {shown.map(({ row, index }) => (
          <li key={row.key} className="db-row db-name-row">
            <TextCell value={row.name} label={`${capital} ${index + 1}`} maxLength={maxLength} placeholder={`${capital} name`} autoFocus={!row.name} error={state.errors[String(index)]} onChange={(name) => state.edit(rows.map((item) => (item.key === row.key ? { ...item, name } : item)))} />
            <RowActions name={row.name} index={index} total={rows.length} onMove={searching ? undefined : (to) => state.edit(move(rows, index, to))} onRemove={() => state.edit(rows.filter((item) => item.key !== row.key))} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** A list's card before its unit is chosen: the header with the picker, and nothing else yet. */
export function UnpickedPanel({ title, info, picker }: { title: string; info: ReactNode; picker: ReactNode }) {
  const titleId = useId();
  return (
    <section className="portal-card portal-settings sec-settings db-settings is-unpicked" aria-labelledby={titleId}>
      <div className="db-panel-head">
        <h2 className="db-panel-title" id={titleId}>{title}<InfoTip label={`About ${title}`}>{info}</InfoTip></h2>
        {picker}
      </div>
    </section>
  );
}

/**
 * Programs & Majors. Every college's programs come with the page, so picking a college shows its
 * list straight away, opening under the picker, with no trip to the server. The address follows
 * the pick (?unit=…), so a reload or a shared link opens the same college.
 */
/** The unit a list shows, picked in its header: shown in place, with the address following the pick. */
function usePickedUnit(initial: string | null) {
  const [unit, setUnit] = useState(initial);
  const [reveal, setReveal] = useState<Reveal>();
  const pick = (next: string) => {
    setReveal(unit !== null ? "fade" : "expand");
    setUnit(next);
    const url = new URL(window.location.href);
    url.searchParams.set("unit", next);
    window.history.replaceState(window.history.state, "", url);
  };
  return { unit, reveal, pick };
}

export function ProgramsWorkspace({ colleges, programs, stamps, usage, initial, readOnly, local, info }: {
  colleges: string[]; programs: Record<string, ProgramEntry[]>; stamps: Record<string, string>; usage: Record<string, Record<string, number>>;
  initial: string | null; readOnly: boolean; local: boolean; info: ReactNode;
}) {
  const { unit: college, reveal, pick } = usePickedUnit(initial);
  const picker = local ? null : <DatabaseCollegeSearch colleges={colleges} value={college ?? ""} onPick={pick} />;
  if (!college) return <UnpickedPanel title="Programs & Majors" info={info} picker={picker} />;
  const section = `programs:${college}`;
  return (
    <ProgramsEditor key={college} college={college} picker={picker} reveal={reveal} title={local ? `${college} programs` : "Programs & Majors"}
      initial={programs[college] ?? []} stamp={stamps[section] ?? null} usage={usage[college] ?? {}} readOnly={readOnly} info={info} />
  );
}

const accountsWord = (total: number) => count(total, "account");

/**
 * A college's programs. Renaming one carries onto the accounts that have it. Retiring one takes it
 * off the forms while whoever has it keeps it; a retired program no account has can be deleted.
 */
function ProgramsEditor({ college, picker, reveal, title, initial, stamp, usage, readOnly, info }: {
  college: string; picker: ReactNode; reveal?: Reveal; title: string; initial: ProgramEntry[]; stamp: string | null; usage: Record<string, number>; readOnly: boolean; info: ReactNode;
}) {
  const state = useSection(`programs:${college}`, initial, stamp, (data) => data.programs[college] ?? []);
  const rows = state.draft;
  const saved = new Map(initial.map((program) => [program.id, program]));
  const used = (program: ProgramEntry) => usage[saved.get(program.id)?.name ?? ""] ?? 0;
  const active = rows.map((program, index) => ({ program, index })).filter(({ program }) => !program.retired);
  const retired = rows.map((program, index) => ({ program, index })).filter(({ program }) => program.retired);
  const update = (id: string, change: Partial<ProgramEntry>) => state.edit(rows.map((program) => (program.id === id ? { ...program, ...change } : program)));
  const remove = (id: string) => state.edit(rows.filter((program) => program.id !== id));
  // Moves swap with the next active program up or down, passing over retired ones.
  const moveActive = (position: number, to: number) => state.edit(move(rows, active[position].index, active[to].index));
  const renamedFrom = (program: ProgramEntry) => {
    const before = saved.get(program.id)?.name;
    return before && before !== program.name ? before : null;
  };
  return (
    <Panel title={title} info={info} picker={picker} reveal={reveal} state={state} readOnly={readOnly}
      onSave={() => state.save(rows, `${college} programs saved. Apply, Request access, accounts and event registration now offer them.`)}
      addLabel="Add program" onAdd={() => state.edit([...rows, { id: `new-${newKey()}`, name: "", retired: false, formerNames: [] }])} addDisabled={rows.length >= 300}>
      {state.errors[""] && <p className="portal-field-error">{state.errors[""]}</p>}
      {active.length === 0 && <p className="portal-empty">No programs. Students from here answer “None” for their program, as Education High School and Junior High School do.</p>}
      <ol className="db-rows">
        {active.map(({ program, index }, position) => {
          const isNew = !saved.has(program.id);
          const total = used(program);
          const from = renamedFrom(program);
          const label = program.name || "this program";
          return (
            <li key={program.id} className="db-row db-name-row">
              <div className="db-position">
                <TextCell value={program.name} label={`Program ${position + 1}`} maxLength={200} placeholder="Program name" autoFocus={isNew && !program.name} error={state.errors[`${index}.name`]} onChange={(name) => update(program.id, { name })} />
                {(total > 0 || from) && <span className="db-derived">
                  {from ? `Renamed from “${from}”.${total ? ` The ${accountsWord(total)} that have it will be updated.` : ""}` : `${accountsWord(total)} ${total === 1 ? "has" : "have"} it.`}
                </span>}
              </div>
              <div className="sec-row-actions">
                <button type="button" className="portal-icon-button" aria-label={`Move ${label} up`} title="Move up" disabled={position === 0} onClick={() => moveActive(position, position - 1)}><ArrowUp size={15} aria-hidden="true" /></button>
                <button type="button" className="portal-icon-button" aria-label={`Move ${label} down`} title="Move down" disabled={position === active.length - 1} onClick={() => moveActive(position, position + 1)}><ArrowDown size={15} aria-hidden="true" /></button>
                {isNew
                  ? <button type="button" className="portal-icon-button" aria-label={`Delete ${label}`} title="Delete" onClick={() => remove(program.id)}><Trash2 size={15} aria-hidden="true" /></button>
                  : <button type="button" className="portal-icon-button" aria-label={`Retire ${label}`} title="Retire: take it off the forms" onClick={() => update(program.id, { retired: true })}><Archive size={15} aria-hidden="true" /></button>}
              </div>
            </li>
          );
        })}
      </ol>
      {retired.length > 0 && <>
        <p className="db-group-head">Retired · {retired.length}<InfoTip label="About retired programs">Retired programs aren’t offered on Apply, Request access, accounts or event registration. Accounts that already have one keep it and still save with it. One no account has can be deleted.</InfoTip></p>
        <ol className="db-rows is-retired">
          {retired.map(({ program, index }) => {
            const total = used(program);
            const label = program.name || "this program";
            return (
              <li key={program.id} className="db-row db-name-row">
                <div className="db-position">
                  <TextCell value={program.name} label={`Retired program: ${label}`} maxLength={200} error={state.errors[`${index}.name`]} onChange={(name) => update(program.id, { name })} />
                  <span className="db-derived">{total ? `${accountsWord(total)} still ${total === 1 ? "has" : "have"} it.` : "No account has it."}</span>
                </div>
                <div className="sec-row-actions">
                  <button type="button" className="portal-icon-button" aria-label={`Restore ${label}`} title="Restore: offer it on the forms again" onClick={() => update(program.id, { retired: false })}><ArchiveRestore size={15} aria-hidden="true" /></button>
                  <button type="button" className="portal-icon-button" aria-label={`Delete ${label}`} title={total ? "Can’t be deleted while an account has it" : "Delete"} disabled={total > 0} onClick={() => remove(program.id)}><Trash2 size={15} aria-hidden="true" /></button>
                </div>
              </li>
            );
          })}
        </ol>
      </>}
    </Panel>
  );
}

/**
 * Positions, for one unit at a time. Every unit's list comes with the page, so the Central Comelec
 * picks a unit (or itself) in the list's header and sees it straight away; a Local account sees its
 * own, with no picker.
 */
export function UnitWorkspace({ units, data, initial, readOnly, local, info }: {
  units: string[]; data: Pick<ReferenceData, "positions" | "stamps">;
  initial: string | null; readOnly: boolean; local: boolean; info: ReactNode;
}) {
  const { unit, reveal, pick } = usePickedUnit(initial);
  const title = "Positions";
  const picker = local ? null : <DatabaseCollegeSearch colleges={units} value={unit} onPick={pick} central label="Unit" />;
  if (unit === null) return <UnpickedPanel title={title} info={info} picker={picker} />;
  const section = `positions:${unit}`;
  return <PositionsEditor key={section} unit={unit} unitName={unit || "Central Comelec"} stamp={data.stamps[section] ?? null} readOnly={readOnly} picker={picker} reveal={reveal} title={local ? undefined : title}
    initial={data.positions[unit] ?? []} fixed={fixedPositions(unit)} />;
}

// ——— Positions ———

export function PositionsEditor({ unit, unitName, initial, stamp, readOnly, fixed, picker, reveal, title }: {
  unit: string; unitName: string; initial: UnitPosition[]; stamp: string | null; readOnly: boolean; fixed: readonly string[]; picker?: ReactNode; reveal?: Reveal; title?: string;
}) {
  const state = useSection(`positions:${unit}`, initial, stamp, (data) => data.positions[unit] ?? []);
  const rows = state.draft;
  const savedNames = new Map(initial.map((position) => [position.id, position.name]));
  const isFixed = (position: UnitPosition) => fixed.includes(savedNames.get(position.id) ?? "");
  return (
    <Panel title={title ?? `${unitName} positions`} picker={picker} reveal={reveal} state={state} readOnly={readOnly} onSave={() => state.save(rows, `${unitName} positions saved. Accounts, the Directory and recruitment now use them.`)}
      addLabel="Add position" onAdd={() => state.edit([...rows, { id: `new-${newKey()}`, name: "" }])} addDisabled={rows.length >= 40}
      info={<>The unit’s Executive Board, in order of rank. Each position is a role on the Executive Board; its Executive Associates serve in its office (“Office of the …”), and Recruitment → Slots lists each one as an office with its roles. Renaming one renames it on every account that holds it. A position held by an account can’t be deleted.</>}>
      {state.errors[""] && <p className="portal-field-error">{state.errors[""]}</p>}
      <ol className="db-rows">
        {rows.map((position, index) => {
          const locked = isFixed(position);
          return (
            <li key={position.id} className="db-row db-name-row">
              <div className="db-position">
                <TextCell value={position.name} label={`Position ${index + 1}`} readOnly={locked} maxLength={100} placeholder="Position name" autoFocus={!position.name} error={state.errors[`${index}.name`]} onChange={(name) => state.edit(rows.map((item) => (item.id === position.id ? { ...item, name } : item)))} />
              </div>
              <RowActions name={position.name} index={index} total={rows.length} onMove={(to) => state.edit(move(rows, index, to))} onRemove={() => state.edit(rows.filter((item) => item.id !== position.id))}
                fixed={locked ? "Other parts of the portal look for this position by name (the Chamber of Chairpersons, En Banc, and who writes and signs the Constitution and Elections Code), so it can be moved but not renamed or deleted." : undefined} />
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

// ——— Roles ———

const roleDescriptions: Record<AccountPosition, string> = {
  "executive-board": "Holds a position on a unit’s board.",
  "executive-associate": "Serves in a board member’s office.",
  deputy: "Opens Recruitment, Political Party and Filing of Candidacy.",
  adviser: "Reads the portal without changing it.",
  admin: "The Office for Student Affairs. Reads the portal without changing it.",
};

/**
 * Roles: the five every account holds, named for the whole commission, then the roles the picked
 * unit added for its own accounts. An added role is a role like the five, picked where they are,
 * and opens the same tabs as the one it's based on. One card, one save. The five names are kept
 * here, outside the unit's part, so picking another unit doesn't drop an unsaved rename.
 */
export function RolesWorkspace({ units, data, initial, readOnly, namesReadOnly, local }: {
  units: string[]; data: Pick<ReferenceData, "customRoles" | "roleNames" | "stamps">;
  initial: string; readOnly: boolean; namesReadOnly: boolean; local: boolean;
}) {
  const names = useSection("role-names", data.roleNames, data.stamps["role-names"] ?? null, (saved) => saved.roleNames);
  const { unit, reveal, pick } = usePickedUnit(initial);
  const current = unit ?? "";
  const picker = local ? null : <DatabaseCollegeSearch colleges={units} value={current} onPick={pick} central label="Unit" />;
  const section = `roles:${current}`;
  return <UnitRolesPanel key={section} unit={current} unitName={current || "Central Comelec"} names={names} savedNames={data.roleNames} picker={picker} reveal={reveal}
    initial={data.customRoles[current] ?? []} stamp={data.stamps[section] ?? null}
    readOnly={readOnly} namesReadOnly={namesReadOnly} />;
}

function UnitRolesPanel({ unit, unitName, names, savedNames, initial, stamp, readOnly, namesReadOnly, picker, reveal }: {
  unit: string; unitName: string; names: Section<Record<AccountPosition, string>>; savedNames: Record<AccountPosition, string>;
  initial: CustomRole[]; stamp: string | null; readOnly: boolean; namesReadOnly: boolean; picker: ReactNode; reveal?: Reveal;
}) {
  const router = useRouter();
  const roles = useSection(`roles:${unit}`, initial, stamp, (data) => data.customRoles[unit] ?? []);
  const [saving, startSaving] = useTransition();
  const rows = roles.draft;
  const labels = names.draft;
  const pending = saving || names.pending || roles.pending;
  const state: PanelState = {
    pending, hydrated: roles.hydrated, dirty: names.dirty || roles.dirty,
    discard() { names.discard(); roles.discard(); },
  };
  const save = () => {
    if (pending || !state.dirty) return;
    startSaving(async () => {
      if (names.dirty && !(await names.commit(labels))) return;
      if (roles.dirty && !(await roles.commit(rows))) return;
      toast("Roles saved. Accounts, the Directory, Request access and Recruitment → Slots now use them.");
      router.refresh();
    });
  };
  const basedOn = [{ value: "executive-associate", label: labels["executive-associate"] }, { value: "deputy", label: labels.deputy }];
  return (
    <Panel title="Roles" picker={picker} reveal={reveal} state={state} readOnly={readOnly && namesReadOnly} onSave={save}
      addLabel={readOnly ? undefined : "Add role"} onAdd={() => roles.edit([...rows, { id: `role-${newKey()}`, name: "", position: "deputy" }])} addDisabled={rows.length >= 40}
      info={<>The roles an account can hold. The first five are every unit’s: renaming one changes its name everywhere, and only the Central Comelec’s official account can. A unit can add roles of its own, which only its accounts can hold. An added role opens the same tabs as the role it’s based on (Accounts → Access Control sets those), and Recruitment → Slots can open it in every office. Renaming a role renames it on every account that holds it; one held by an account can’t be deleted.</>}>
      {names.errors[""] && <p className="portal-field-error">{names.errors[""]}</p>}
      {roles.errors[""] && <p className="portal-field-error">{roles.errors[""]}</p>}
      <ol className="db-rows">
        {(Object.keys(roleDescriptions) as AccountPosition[]).map((key) => (
          <li key={key} className="db-row db-role-row">
            <TextCell value={labels[key]} label={`Name of the ${savedNames[key]} role`} readOnly={namesReadOnly} maxLength={40} error={names.errors[key]} onChange={(name) => names.edit({ ...labels, [key]: name })} />
            <span className="db-derived">{roleDescriptions[key]}</span>
          </li>
        ))}
        {rows.map((role, index) => (
          <li key={role.id} className="db-row db-added-row">
            <TextCell value={role.name} label={`Added role ${index + 1}`} readOnly={readOnly} maxLength={100} placeholder="Role name" autoFocus={!role.name} error={roles.errors[`${index}.name`]} onChange={(name) => roles.edit(rows.map((item) => (item.id === role.id ? { ...item, name } : item)))} />
            <div className="db-added-access">
              <span className="db-derived">Only {unitName}’s accounts. Same tabs as</span>
              <Dropdown label={`Role ${role.name || "this role"} is based on`} value={role.position} options={basedOn} disabled={readOnly} onChange={(position) => roles.edit(rows.map((item) => (item.id === role.id ? { ...item, position: position as CustomRole["position"] } : item)))} />
            </div>
            {!readOnly && <RowActions name={role.name} index={index} total={rows.length} onRemove={() => roles.edit(rows.filter((item) => item.id !== role.id))} />}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

// ——— Elective positions ———

/**
 * Elective positions, for one unit at a time: what candidates run for on Filing of Candidacy. Kept
 * apart from the Database's other lists (public.elective_positions), with the same picker, rows and
 * footer. A unit that hasn't saved its own shows the CSC Executive Board it starts with.
 */
export function ElectivePositionsWorkspace({ units, positions, stamps, initial, readOnly, local, info }: {
  units: string[]; positions: Record<string, ElectivePosition[]>; stamps: Record<string, string>;
  initial: string | null; readOnly: boolean; local: boolean; info: ReactNode;
}) {
  const { unit, reveal, pick } = usePickedUnit(initial);
  const title = "Elective positions";
  const picker = local ? null : <DatabaseCollegeSearch colleges={units} value={unit} onPick={pick} central label="Unit" />;
  if (unit === null) return <UnpickedPanel title={title} info={info} picker={picker} />;
  const unitName = unit ? `${unit} Student Council` : "Central Student Council";
  return <ElectivePositionsEditor key={unit} unit={unit} unitName={unitName} initial={positions[unit] ?? []} stamp={stamps[unit] ?? null} readOnly={readOnly} picker={picker} reveal={reveal} title={local ? `${unitName} positions` : title} info={info} />;
}

function ElectivePositionsEditor({ unit, unitName, initial, stamp: initialStamp, readOnly, picker, reveal, title, info }: {
  unit: string; unitName: string; initial: ElectivePosition[]; stamp: string | null; readOnly: boolean; picker?: ReactNode; reveal?: Reveal; title: string; info: ReactNode;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [rows, setRows] = useState(initial);
  const [stamp, setStamp] = useState(initialStamp);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved);
  const edit = (next: ElectivePosition[]) => { setRows(next); setErrors({}); };
  const state = { pending, hydrated, dirty, discard: () => { setRows(saved); setErrors({}); } };
  const save = () => {
    if (pending || !dirty) return;
    startTransition(async () => {
      try {
        const result = await saveElectivePositionsAction(unit, stamp, rows);
        if ("error" in result) {
          toast(result.error, "error");
          setErrors(result.fieldErrors ?? {});
          return;
        }
        setSaved(result.positions);
        setRows(result.positions);
        setStamp(result.stamp);
        toast(`${unitName} positions saved. Filing of Candidacy now offers them.`);
        router.refresh();
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t save the list. Try again.", "error");
      }
    });
  };
  return (
    <Panel title={title} picker={picker} reveal={reveal} state={state} readOnly={readOnly} onSave={save} info={info}
      addLabel="Add position" onAdd={() => edit([...rows, { id: `new-${newKey()}`, name: "" }])} addDisabled={rows.length >= 40}>
      {errors[""] && <p className="portal-field-error">{errors[""]}</p>}
      <ol className="db-rows">
        {rows.map((position, index) => (
          <li key={position.id} className="db-row db-name-row">
            <div className="db-position">
              <TextCell value={position.name} label={`Position ${index + 1}`} maxLength={100} placeholder="Position name" autoFocus={!position.name} error={errors[`${index}.name`]} onChange={(name) => edit(rows.map((item) => (item.id === position.id ? { ...item, name } : item)))} />
            </div>
            <RowActions name={position.name} index={index} total={rows.length} onMove={(to) => edit(move(rows, index, to))} onRemove={() => edit(rows.filter((item) => item.id !== position.id))} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { AlertTriangle, ChevronRight, Copy, Plus, Search, Trash2, X } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { documentTypeLabels, workingDocumentKind, type Letter, type LetterConflict, type LetterSaveResult, type LetterValues, type WorkingDocumentKind } from "@/lib/letters/options";
import { numberMode, type SecretariatSettings, type ToneItem } from "@/lib/letters/settings";
import { Combobox } from "@/components/combobox";
import { deleteLetter, getLetterNumberPreview, saveLetter, setLetterLabel } from "@/lib/portal/letter-actions";
import { deleteMinute, getMinuteNumberPreview, saveMinute, setMinuteLabel } from "@/lib/portal/minute-actions";
import { compareEdits, fieldLabels, setField, valuesOf } from "@/lib/letters/conflict";
import { LetterLabel } from "./letter-label";
import { toast } from "./toast";
import { Dropdown } from "./dropdown";
import { TitleWithInfo } from "./info-tip";
import { ViewOnlyTag } from "./view-only";
import { WorkingDocumentLink } from "./working-document-link";
import { SlidingFilterButtons } from "./sliding-filters";
import { LetterDocumentCard, LetterDocumentList } from "./letter-document-sortable";
import { arrayMove } from "@dnd-kit/sortable";
import "./letters-tracker.css";

const PAGE_SIZE = 25;
const emptyLetter: LetterValues = { title: "", label: null, type: "", status: "", controlNumber: "", destinationOffice: "", workingDocuments: [], remarks: "", notifyStatusUpdates: false, remarkPresets: [] };
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

const documentTypeOptions = (Object.keys(documentTypeLabels) as WorkingDocumentKind[]).map(value => ({ value, label: documentTypeLabels[value] }));

function LetterStatus({ status, statuses }: { status: string; statuses: ToneItem[] }) {
  return <span className={`portal-letter-status is-tone-${statuses.find(item => item.name === status)?.tone ?? "grey"}`}><span className="portal-letter-status-dot" aria-hidden="true" />{status}</span>;
}

export function LettersTracker({ rows, readOnly, loadError, preparerName, settings, kind = "letters" }: { rows: Letter[]; readOnly: boolean; loadError: string | null; preparerName: string; settings: SecretariatSettings; kind?: "letters" | "minutes" }) {
  const minutes = kind === "minutes";
  const noun = minutes ? "meeting minutes" : "letter";
  const plural = minutes ? "meeting minutes" : "letters";
  const title = minutes ? "Minutes of the Meetings" : "Letters Tracker";
  const addLabel = minutes ? "Add meeting minutes" : "Add letter";
  const tracker = settings[kind];
  const typeOptions = tracker.types.map(type => ({ value: type.name, label: type.name }));
  const statusOptions = settings.statuses.map(status => ({ value: status.name, label: status.name }));
  const labelOptions = settings.labels.map(label => ({ value: label.name, label: label.name }));
  const officeNames = settings.offices.map(office => office.name);
  const blank: LetterValues = { ...emptyLetter, type: tracker.types[0]?.name ?? "", status: settings.statuses[0]?.name ?? "" };
  const previewNumber = minutes ? getMinuteNumberPreview : getLetterNumberPreview;
  const saveRecord = minutes ? saveMinute : saveLetter;
  const deleteRecord = minutes ? deleteMinute : deleteLetter;
  const labelRecord = minutes ? setMinuteLabel : setLetterLabel;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Letter | null>(null);
  const [draft, setDraft] = useState<LetterValues>(blank);
  const [documentKeys, setDocumentKeys] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<LetterSaveResult | null>(null);
  const [view, setView] = useState<"details" | "documents" | "remarks">("details");
  const [creating, setCreating] = useState(false);
  const [numberPreview, setNumberPreview] = useState({ type: "", value: "" });
  const [previewError, setPreviewError] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  /** Someone else saved this record while it was open, and changed what this person changed too. */
  const [conflict, setConflict] = useState<(LetterConflict & { fields: string[] }) | null>(null);
  /** The version this person chose to save over. */
  const [saveOver, setSaveOver] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = rows.filter(row => (filter === "all" || (filter === "none" ? !row.label : row.label === filter)) && terms.every(term => `${row.controlNumber} ${row.title} ${row.type} ${row.status} ${row.label ?? ""}`.toLowerCase().includes(term)));
  const pages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const shown = matching.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const fieldErrors = feedback?.fieldErrors ?? {};
  const changed = selected ? (Object.keys(emptyLetter) as Array<keyof LetterValues>).some(key => JSON.stringify(draft[key]) !== JSON.stringify(selected[key])) : true;
  // How the number is made for the chosen type, and whether the record keeps the number it has.
  const draftType = tracker.types.find(type => type.name === draft.type);
  const mode = numberMode(tracker, draftType);
  // Mirrors numbering() in src/lib/letters/store.ts: a record keeps its number while its type stays.
  const keepsNumber = Boolean(selected) && (draft.type === selected?.type || (mode === "auto" ? selected?.controlFormat === draftType?.format : !selected?.controlFormat && selected?.controlNumber === draftType?.format));
  const previewFor = modalOpen && !readOnly && mode === "auto" && !keepsNumber ? draft.type : null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied to clipboard.`);
    } catch {
      toast(`Couldn’t copy ${label.toLowerCase()}. Try selecting and copying the text.`, "error");
    }
  }

  useEffect(() => {
    if (previewFor === null || pending) return;
    let active = true;
    let fetching = false;
    const refresh = async () => {
      if (fetching || document.visibilityState === "hidden") return;
      fetching = true;
      try {
        const result = await previewNumber(previewFor);
        if (!active) return;
        setPreviewError(result.error ?? "");
        if (result.controlNumber) setNumberPreview({ type: previewFor, value: result.controlNumber });
      } catch (error) {
        unstable_rethrow(error);
        if (active) setPreviewError(`Couldn’t refresh the control number. Try reopening the ${noun}.`);
      } finally {
        fetching = false;
      }
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [previewFor, pending, previewNumber, noun]);

  function open(letter: Letter | null) {
    setSelected(letter);
    setDeleteArmed(false);
    setDraft(letter ? valuesOf(letter) : { ...blank });
    setConflict(null);
    setSaveOver(null);
    setDocumentKeys(letter?.workingDocuments.map(() => crypto.randomUUID()) ?? []);
    setFeedback(null);
    setView("details");
    setCreating(letter === null);
    setNumberPreview({ type: "", value: "" });
    setPreviewError("");
    dialog.current?.showModal();
    setModalOpen(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        let result = await saveRecord(selected?.id ?? null, data);
        // Someone else saved it while it was open. Changes to different fields are put together and
        // saved over theirs; the same field changed by both is this person's to decide.
        let alsoChangedBy: string | null = null;
        if (result.conflict && selected && !saveOver) {
          const saved = result.conflict.letter;
          const { theirs, clash } = compareEdits(selected, draft, saved);
          if (!clash.length) {
            for (const key of theirs) setField(data, key, saved[key]);
            data.set("_expected", saved.updatedAt);
            alsoChangedBy = result.conflict.by;
            result = await saveRecord(selected.id, data);
          }
        }
        setSaveOver(null);
        setFeedback(result);
        if (result.conflict && selected) {
          const saved = result.conflict.letter;
          const { theirs, clash } = compareEdits(selected, draft, saved);
          // Their changes to other fields are taken in now, so saving over theirs keeps them.
          setDraft(current => ({ ...current, ...Object.fromEntries(theirs.map(key => [key, saved[key]])) }));
          if (theirs.includes("workingDocuments")) setDocumentKeys(saved.workingDocuments.map(() => crypto.randomUUID()));
          setConflict({ ...result.conflict, fields: [...new Set(clash.map(key => fieldLabels[key]))] });
          toast(result.error, "error");
          return;
        }
        if (result.error) toast(result.error, "error");
        if (result.fieldErrors) setView(Object.keys(result.fieldErrors).some(key => key.startsWith("workingDocuments")) ? "documents" : (result.fieldErrors.remarks || Object.keys(result.fieldErrors).some(key => key.startsWith("remarkPresets"))) ? "remarks" : "details");
        if (result.letter) {
          const what = minutes ? "Meeting minutes" : "Letter";
          toast(!selected ? `${what} added.` : alsoChangedBy === "You" ? `${what} updated. What you saved in another tab meanwhile was kept too.` : alsoChangedBy ? `${what} updated. ${alsoChangedBy} also changed ${minutes ? "them" : "it"} while you were editing, and those changes were kept.` : `${what} updated.`);
          dialog.current?.close();
        }
      } catch (error) {
        unstable_rethrow(error);
        toast(`Couldn’t save ${noun}. Try again.`, "error");
      }
    });
  }

  /** Starts again from the version someone else saved. */
  function loadTheirs() {
    if (!conflict) return;
    setSelected(conflict.letter);
    setDraft(valuesOf(conflict.letter));
    setDocumentKeys(conflict.letter.workingDocuments.map(() => crypto.randomUUID()));
    setConflict(null);
    setFeedback(null);
  }

  /** Saves what's in the form over the version someone else saved. */
  function saveMine(form: HTMLFormElement | null) {
    if (!conflict) return;
    flushSync(() => { setSaveOver(conflict.letter.updatedAt); setConflict(null); });
    form?.requestSubmit();
  }

  function changeLabel(letter: Letter, label: Letter["label"]) {
    if (readOnly || pending) return;
    startTransition(async () => {
      try {
        const result = await labelRecord(letter.id, label);
        if (result.error) toast(result.error, "error");
      } catch (error) {
        unstable_rethrow(error);
        toast("Couldn’t save this label. Try again.", "error");
      }
    });
  }

  function remove() {
    if (!selected || readOnly || pending) return;
    startTransition(async () => {
      try {
        const result = await deleteRecord(selected.id);
        if (result.error) {
          toast(result.error, "error");
          setDeleteArmed(false);
          return;
        }
        toast(`${minutes ? "Meeting minutes" : "Letter"} deleted.`);
        dialog.current?.close();
      } catch (error) {
        unstable_rethrow(error);
        toast(`Couldn’t delete ${noun}. Try again.`, "error");
        setDeleteArmed(false);
      }
    });
  }

  const update = <Key extends keyof LetterValues>(key: Key, value: LetterValues[Key]) => {
    setDraft(previous => ({ ...previous, [key]: value }));
    setFeedback(null);
  };
  function moveDocument(from: number, to: number) {
    if (readOnly || pending || from < 0 || to < 0 || from >= documentKeys.length || to >= documentKeys.length) return;
    update("workingDocuments", arrayMove(draft.workingDocuments, from, to));
    setDocumentKeys(arrayMove(documentKeys, from, to));
  }
  const errorFor = (key: keyof LetterValues) => fieldErrors[key] ? <span className="portal-field-error" id={`${id}-${key}-error`}>{fieldErrors[key]}</span> : null;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Secretariat</p>
          <TitleWithInfo info={`Track ${minutes ? "meeting minutes" : "letters and reports"} by control number, type and status. Open a row to view or edit its details. Working documents support Google Docs, Google Sheets, Google Drive and other HTTPS links.`}>{title}</TitleWithInfo>
        </div>
        {readOnly ? <ViewOnlyTag /> : <button type="button" className="portal-button" disabled={Boolean(loadError)} aria-haspopup="dialog" aria-controls={id} onClick={() => open(null)}><Plus size={16} aria-hidden="true" />{addLabel}</button>}
      </header>
      <section className="portal-card is-flush">
        <div className="portal-table-tools portal-letters-tools">
          <div className="portal-letters-filter">
            <span className="portal-visually-hidden" id={`${id}-filter`}>Label</span>
            <Dropdown label={`Filter ${plural} by label`} labelledBy={`${id}-filter`} value={filter} options={[{ value: "all", label: "All labels" }, { value: "none", label: "No label" }, ...labelOptions]} onChange={value => { setFilter(value); setPage(0); }} />
          </div>
          <label className="portal-search">
            <span className="portal-visually-hidden">Search {plural}</span>
            <Search size={15} aria-hidden="true" />
            <input className="portal-input" type="search" value={query} placeholder="Search control number, title or type" onChange={event => { setQuery(event.target.value); setPage(0); }} />
          </label>
        </div>
        {loadError ? <p className="portal-form-error portal-letters-load-error" role="alert">{loadError}</p> : <>
          <div className="portal-table-wrap">
            <table className="portal-table portal-letters-table">
              <thead><tr><th>Control Number</th><th>Label</th><th>Title</th><th>Status</th><th>Working Document</th><th aria-label={`${noun} details`} /></tr></thead>
              <tbody>
                {shown.map(letter => <tr key={letter.id} className="portal-letter-row" onClick={event => {
                  if ((event.target as Element).closest("button, a, .portal-document-icon, .portal-letter-label")) return;
                  open(letter);
                }}>
                  <td className="is-nowrap portal-letter-control"><button type="button" className="portal-letter-copy" title="Copy control number" aria-label={`Copy control number ${letter.controlNumber}`} onClick={() => void copy(letter.controlNumber, "Control number")}>{letter.controlNumber}</button></td>
                  <td><LetterLabel labels={settings.labels} value={letter.label} disabled={readOnly || pending} onChange={label => changeLabel(letter, label)} /></td>
                  <td><button type="button" className="portal-letter-copy portal-row-title" title="Copy title" aria-label={`Copy title ${letter.title}`} onClick={() => void copy(letter.title, "Title")}>{letter.title}</button></td>
                  <td><LetterStatus status={letter.status} statuses={settings.statuses} /></td>
                  <td><WorkingDocumentLink documents={letter.workingDocuments} /></td>
                  <td className="portal-row-actions"><button type="button" className="portal-list-review" aria-haspopup="dialog" aria-controls={id} aria-label={`Open ${noun} ${letter.controlNumber}: ${letter.title}`} onClick={() => open(letter)}><ChevronRight size={18} strokeWidth={1.8} aria-hidden="true" /></button></td>
                </tr>)}
                {shown.length === 0 && <tr><td colSpan={6}><p className="portal-empty" role="status">{rows.length ? `No ${plural} match the selected label or search.` : `No ${plural} have been added yet.`}</p></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="portal-table-foot">
            <p role="status">{matching.length ? `Showing ${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + shown.length} of ${matching.length}` : `0 ${plural}`}</p>
            {pages > 1 && <div className="portal-pager"><button type="button" className="portal-button is-small is-ghost" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><button type="button" className="portal-button is-small is-ghost" disabled={current === pages - 1} onClick={() => setPage(current + 1)}>Next</button></div>}
          </div>
        </>}
      </section>

      <dialog ref={dialog} id={id} className="portal-registrant-dialog portal-letter-dialog" aria-labelledby={titleId} onClose={() => { setCreating(false); setModalOpen(false); }} onCancel={event => { if (pending) event.preventDefault(); }} onClick={event => { if (event.target === event.currentTarget && !pending) dialog.current?.close(); }}>
        <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label={`Close ${noun} details`} autoFocus disabled={pending} onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button>
        <form className="portal-registrant-receipt" onSubmit={submit} noValidate>
          <input type="hidden" name="_expected" value={saveOver ?? selected?.updatedAt ?? ""} />
          <header className="portal-registrant-receipt-head">
            <div className="portal-registrant-heading">
              <h2 id={titleId}>{selected ? selected.title : addLabel}</h2>
              <div className="portal-registrant-meta portal-letter-dates">
                {selected ? <>
                  <span className="portal-registrant-date">Added <time dateTime={selected.createdAt}>{new Date(selected.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</time></span>
                  <span className="portal-registrant-date"><span>Last modified date</span>: <time dateTime={selected.updatedAt}>{new Date(selected.updatedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short" })}</time></span>
                </> : <span className="portal-registrant-date">Dates recorded automatically when saved</span>}
              </div>
            </div>
            <div className="portal-letter-header-label"><LetterLabel name="label" labels={settings.labels} value={draft.label} disabled={readOnly || pending} onChange={label => update("label", label)} /></div>
          </header>
          <div className="portal-registrant-receipt-body">
            <dl className="portal-letter-preparer">
              <div><dt>Prepared by</dt><dd>{selected?.preparedBy || preparerName}{selected?.preparedByEmail && <small>{selected.preparedByEmail}</small>}</dd></div>
              <div className="portal-letter-view-picker"><dt className="portal-visually-hidden">View</dt><dd><SlidingFilterButtons active={view} label={`${minutes ? "Meeting minutes" : "Letter"} details view`} onChange={setView} items={[{ key: "details", label: "Details" }, { key: "documents", label: "Working Documents" }, { key: "remarks", label: "Remarks" }]} /></dd></div>
            </dl>
            {previewError && <p className="portal-form-error" role="alert">{previewError}</p>}
            <fieldset className="portal-letter-fields" disabled={readOnly || pending}>
              <div className="portal-form-grid portal-letter-details-panel" hidden={view !== "details"}>
                {mode === "manual" ? <label className={`portal-field is-wide${fieldErrors.controlNumber ? " has-error" : ""}`}>
                  <span className="portal-field-label">Control Number</span>
                  <input name="controlNumber" value={draft.controlNumber} required maxLength={100} placeholder="Type the control number" aria-invalid={Boolean(fieldErrors.controlNumber)} aria-describedby={fieldErrors.controlNumber ? `${id}-controlNumber-error` : undefined} onChange={event => update("controlNumber", event.target.value)} onBlur={event => update("controlNumber", event.target.value.replace(/\s+/g, " ").trim())} />
                  {errorFor("controlNumber") ?? <span className="portal-field-hint">{tracker.autoIncrement ? `${draft.type} numbers are typed by hand.` : "Automatic numbering is off under Secretariat → Settings."}</span>}
                </label> : <label className="portal-field is-wide">
                  <span className="portal-field-label">Control Number</span>
                  <input readOnly className="is-fixed" value={keepsNumber ? selected?.controlNumber ?? "" : mode === "fixed" ? draftType?.format ?? "" : numberPreview.type === draft.type ? numberPreview.value : ""} placeholder="Loading…" />
                  {keepsNumber ? null : mode === "fixed" ? <span className="portal-field-hint">University-issued number for every {draft.type}.</span> : <span className="portal-field-hint">{selected ? "The next number is assigned when you save." : "Assigned when you save. If someone saves first, you get the next one."}</span>}
                </label>}
                <label className={`portal-field is-wide${fieldErrors.title ? " has-error" : ""}`}><span className="portal-field-label">Title</span><input name="title" value={draft.title} required maxLength={300} aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? `${id}-title-error` : undefined} onChange={event => update("title", event.target.value)} />{errorFor("title")}</label>
                <div className={`portal-field${fieldErrors.type ? " has-error" : ""}`}><span className="portal-field-label" id={`${id}-type`}>Type</span><Dropdown name="type" labelledBy={`${id}-type`} value={draft.type} options={typeOptions} disabled={readOnly || pending} invalid={Boolean(fieldErrors.type)} onChange={value => update("type", value)} />{errorFor("type")}</div>
                <div className={`portal-field${fieldErrors.status ? " has-error" : ""}`}><span className="portal-field-label" id={`${id}-status`}>Status</span><Dropdown name="status" labelledBy={`${id}-status`} value={draft.status} options={statusOptions} disabled={readOnly || pending} invalid={Boolean(fieldErrors.status)} onChange={value => update("status", value)} />{errorFor("status")}</div>
                <div className={`portal-field is-wide${fieldErrors.destinationOffice ? " has-error" : ""}`}>
                  <span className="portal-field-label" id={`${id}-destination`}>Destination Office</span>
                  <Combobox key={`${selected?.id ?? "new"}-${selected?.updatedAt ?? creating}`} name="destinationOffice" freeText options={officeNames} value={draft.destinationOffice} onChange={value => update("destinationOffice", value)} placeholder="Type any office, or pick a suggestion" labelledBy={`${id}-destination`} disabled={readOnly || pending} invalid={Boolean(fieldErrors.destinationOffice)} describedBy={fieldErrors.destinationOffice ? `${id}-destinationOffice-error` : undefined} emptyText="No suggestion matches. What you typed is kept." />
                  {errorFor("destinationOffice")}
                </div>
                <div className="portal-field is-wide portal-letter-notifications">
                  <label className="portal-letter-checkbox"><input type="checkbox" name="notifyStatusUpdates" checked={draft.notifyStatusUpdates} onChange={event => update("notifyStatusUpdates", event.target.checked)} /><span>Notify Status Updates</span></label>
                  <p className="portal-muted">Send status changes to the portal inbox of all active members of this unit.</p>
                </div>
              </div>
                <section className="portal-field is-wide portal-letter-documents" aria-labelledby={`${id}-documents`} hidden={view !== "documents"}>
                  <div className="portal-letter-documents-head">
                    <span className="portal-field-label" id={`${id}-documents`}>Working Documents</span>
                    <WorkingDocumentLink documents={draft.workingDocuments} modal />
                  </div>
                  <input type="hidden" name="workingDocuments" value={JSON.stringify(draft.workingDocuments)} />
                  {fieldErrors.workingDocuments && <span className="portal-field-error">{fieldErrors.workingDocuments}</span>}
                  <LetterDocumentList ids={documentKeys} onMove={moveDocument}>
                  {draft.workingDocuments.map((document, index) => {
                    const typeError = fieldErrors[`workingDocuments.${index}.type`];
                    const urlError = fieldErrors[`workingDocuments.${index}.url`];
                    return <LetterDocumentCard key={documentKeys[index]} id={documentKeys[index]} index={index} count={draft.workingDocuments.length} onMove={moveDocument} disabled={readOnly || pending}>
                      <div className={`portal-field${typeError ? " has-error" : ""}`}>
                        <span className="portal-field-label" id={`${id}-document-type-${index}`}>Document type</span>
                        <Dropdown value={document.type} options={documentTypeOptions} labelledBy={`${id}-document-type-${index}`} disabled={readOnly || pending} invalid={Boolean(typeError)} onChange={value => update("workingDocuments", draft.workingDocuments.map((item, position) => position === index ? { ...item, type: value as WorkingDocumentKind } : item))} />
                        {typeError && <span className="portal-field-error">{typeError}</span>}
                      </div>
                      <div className={`portal-field${urlError ? " has-error" : ""}`}>
                        <label className="portal-field-label" htmlFor={`${id}-document-url-${index}`}>{index === 0 ? "Main Working Document" : "Reference Material"}</label>
                        <div className={`portal-letter-link-input${readOnly ? "" : " has-remove"}`}>
                          <input id={`${id}-document-url-${index}`} type="url" value={document.url} required maxLength={2000} placeholder="Paste document link" aria-invalid={Boolean(urlError)} aria-describedby={urlError ? `${id}-document-url-error-${index}` : undefined} onChange={event => { const url = event.target.value; update("workingDocuments", draft.workingDocuments.map((item, position) => position === index ? { url, type: item.type === "pdf" ? "pdf" : workingDocumentKind(url) ?? item.type } : item)); }} />
                          <div className="portal-letter-link-actions">
                            <button type="button" className="portal-letter-copy-link" title="Copy link" aria-label={`Copy ${index === 0 ? "main working document" : `reference material ${index}`} link`} disabled={pending || !document.url.trim()} onClick={() => void copy(document.url, index === 0 ? "Main working document link" : "Reference material link")}><Copy size={16} aria-hidden="true" /></button>
                            {!readOnly && <button type="button" className="portal-letter-copy-link" title="Remove link" disabled={pending} aria-label={`Remove document link ${index + 1}`} onClick={() => { update("workingDocuments", draft.workingDocuments.filter((_, position) => position !== index)); setDocumentKeys(documentKeys.filter((_, position) => position !== index)); }}><X size={16} aria-hidden="true" /></button>}
                          </div>
                        </div>
                        {urlError && <span className="portal-field-error" id={`${id}-document-url-error-${index}`}>{urlError}</span>}
                      </div>
                    </LetterDocumentCard>;
                  })}
                  </LetterDocumentList>
                  {!readOnly && <button type="button" className="portal-button is-small is-ghost portal-letter-add-document" disabled={pending || draft.workingDocuments.length >= 100} onClick={() => { update("workingDocuments", [...draft.workingDocuments, { type: "docs", url: "" }]); setDocumentKeys([...documentKeys, crypto.randomUUID()]); }}><Plus size={14} aria-hidden="true" />Add link</button>}
                </section>
              <section className="portal-field portal-letter-remarks" hidden={view !== "remarks"}>
                <div className="portal-letter-remark-presets" role="group" aria-label="Preset remarks">
                  {settings.remarkPresets.map(({ id: key, name: preset }) => <label key={key} className="portal-letter-checkbox"><input type="checkbox" name="remarkPresets" value={preset} checked={draft.remarkPresets.includes(preset)} onChange={event => update("remarkPresets", event.target.checked ? [...draft.remarkPresets, preset] : draft.remarkPresets.filter(value => value !== preset))} /><span>{preset}</span></label>)}
                  {errorFor("remarkPresets")}
                </div>
                <label className="portal-field-label" htmlFor={`${id}-remarks`}>Remarks</label>
                <textarea id={`${id}-remarks`} name="remarks" value={draft.remarks} rows={8} maxLength={10000} placeholder={`Add notes or remarks about ${noun}`} aria-invalid={Boolean(fieldErrors.remarks)} aria-describedby={fieldErrors.remarks ? `${id}-remarks-error` : undefined} onChange={event => update("remarks", event.target.value)} />
                {errorFor("remarks")}
              </section>
            </fieldset>
          </div>
          {conflict && <div className="portal-edit-conflict portal-letter-conflict" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div className="portal-edit-conflict-text">
              <strong>{conflict.by === "You" ? "You saved this in another tab" : `${conflict.by} saved this`} at {timeOf(conflict.letter.updatedAt)}</strong>
              <span>{conflict.fields.length ? `You both changed ${conflict.fields.length < 2 ? conflict.fields[0] : `${conflict.fields.slice(0, -1).join(", ")} and ${conflict.fields.at(-1)}`}. ` : ""}Your version is still here, with their other changes taken in. Load theirs to start again from it, or save yours over it.</span>
            </div>
            <div className="portal-edit-conflict-actions">
              <button type="button" className="portal-button is-ghost is-small" disabled={pending} onClick={loadTheirs}>Load their version</button>
              <button type="button" className="portal-button is-danger-ghost is-small" disabled={pending} onClick={event => saveMine(event.currentTarget.form)}>Save mine over theirs</button>
            </div>
          </div>}
          <footer className="portal-registrant-receipt-foot">
            {readOnly ? <ViewOnlyTag /> : deleteArmed ? <div className="portal-letter-delete-confirm">
              <span className="portal-muted">Delete permanently?</span>
              <button type="button" className="portal-registrant-action-button" disabled={pending} onClick={() => setDeleteArmed(false)}>Keep</button>
              <button type="button" className="portal-registrant-action-button portal-letter-delete" disabled={pending} onClick={remove}><Trash2 size={16} aria-hidden="true" />{pending ? "Deleting…" : "Delete"}</button>
            </div> : <button type="button" className="portal-registrant-action-button portal-letter-delete" disabled={!selected || pending} aria-label={`Delete ${noun}`} title={selected ? `Delete ${noun}` : `Save ${noun} before deleting it`} onClick={() => setDeleteArmed(true)}><Trash2 size={16} aria-hidden="true" /></button>}
            <div className="portal-registrant-actions"><button type="button" className="portal-registrant-action-button" disabled={pending} onClick={() => dialog.current?.close()}>{readOnly ? "Close" : "Cancel"}</button>{!readOnly && <button type="submit" className="portal-registrant-action-button" disabled={pending || !changed}>{pending && !deleteArmed ? "Saving…" : selected ? "Save changes" : addLabel}</button>}</div>
          </footer>
        </form>
      </dialog>
    </main>
  );
}

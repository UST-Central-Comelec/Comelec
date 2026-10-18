"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useId, useState, type FormEvent } from "react";
import { CalendarClock, FileText, Link2, MapPin, MessageSquareText, Send, Upload } from "lucide-react";
import { CloseIcon, EditIcon } from "@/components/action-icons";
import { DatePicker } from "@/components/portal/date-picker";
import { DeleteButton } from "@/components/portal/delete-button";
import { Dropdown } from "@/components/portal/dropdown";
import { InfoTip } from "@/components/portal/info-tip";
import { useHydrated } from "@/components/portal/portal-form";
import { TimePicker } from "@/components/portal/time-picker";
import { toast, useToast } from "@/components/portal/toast";
import { cancelMyActivity, saveActivity, withdrawMyMaterial, type ActionResult, type CampaignState } from "@/lib/candidacy/campaign-actions";
import {
  MAX_MATERIAL_FILES, NOTICE_HOURS, activityKinds, activityStatusLabel, activityStatusTone, formatSize, isMaterialKind, materialKinds, materialStatusLabel, materialStatusTone, sizeLimit, sizeProblem,
  type ActivityKind, type CampaignActivity, type CampaignMaterial, type MaterialKind,
} from "@/lib/candidacy/campaign";
import type { CalendarHighlight } from "@/lib/calendar/options";
import { formatSlot, manilaParts } from "@/lib/filing-portal/services";
import "./documents.css";
import { Busy } from "@/components/busy";

// A qualified candidate's campaign in the filing portal: the materials they send for the unit's
// approval (Candidacy → Campaign materials), and their campaign schedule (Candidacy → Campaign
// schedule). Each form sits beside the list of what's been sent, and opens again on an item to
// revise or change it.

const report = (result: ActionResult) => toast(result.error ?? result.ok ?? "Done.", result.error ? "error" : "ok");
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const when = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
const manilaDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

/** The unit's note: `changes` when it asked for a revised version; `warn` when it holds the item up. */
function Feedback({ text, warn, changes = false, unit, at }: { text: string; warn: boolean; changes?: boolean; unit: string; at: string | null }) {
  return (
    <div className={`pp-feedback${warn ? " is-changes" : ""}`}>
      <MessageSquareText size={16} aria-hidden="true" />
      <div><strong>{changes ? `${unit} asked for changes` : `${unit} wrote`}</strong><p>{text}</p>{at && <small>{when(at)}</small>}</div>
    </div>
  );
}

/* Materials */

/** `open`: the candidate is qualified, so materials can be sent. Otherwise only what was sent is shown. */
export function MaterialsBoard({ materials, underParty, partyName, unit, open }: { materials: CampaignMaterial[]; underParty: boolean; partyName: string | null; unit: string; open: boolean }) {
  const [editing, setEditing] = useState<CampaignMaterial | null>(null);
  return (
    <div className={`pp-service-grid${open ? "" : " is-single"}`}>
      {open && <MaterialForm key={editing?.id ?? "new"} editing={editing} underParty={underParty} partyName={partyName} onDone={() => setEditing(null)} />}
      <section className="portal-card pp-service-side" aria-labelledby="materials-list">
        <h2 id="materials-list">Sent for approval</h2>
        {materials.length ? (
          <ul className="pp-service-list">
            {materials.map((material) => (
              <li key={material.id} className={editing?.id === material.id ? "is-editing" : undefined}>
                <div className="pp-service-head">
                  <div><strong>{material.title}</strong><small>{materialKinds[material.kind].label}{formatSize(material) ? ` · ${formatSize(material)}` : ""}{material.showsParty ? ` · With all of ${partyName ?? "the party"}’s candidates` : ""}</small></div>
                  <span className={`portal-tag ${materialStatusTone[material.status]}`}>{materialStatusLabel[material.status]}</span>
                </div>
                <dl className="portal-details pp-service-details">
                  <div><dt>Sent</dt><dd>{when(material.submittedAt)}</dd></div>
                  {material.placement && <div><dt>Where</dt><dd><MapPin size={13} aria-hidden="true" /> {material.placement}</dd></div>}
                  {material.link && <div><dt>Address</dt><dd><a href={material.link} target="_blank" rel="noopener noreferrer"><Link2 size={13} aria-hidden="true" /> {material.link}</a></dd></div>}
                </dl>
                {material.feedback && <Feedback text={material.feedback} warn={material.status === "changes" || material.status === "declined"} changes={material.status === "changes"} unit={unit} at={material.reviewedAt} />}
                {material.files.length > 0 && (
                  <ul className="pp-files" aria-label={`Files for ${material.title}`}>
                    {material.files.map((file, index) => <li key={file.path}><FileText size={15} aria-hidden="true" /><span className="pp-file-name"><a href={`/filing/files/material/${material.id}/${index}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)}</small></span></li>)}
                  </ul>
                )}
                {open && (material.status === "submitted" || material.status === "changes") && (
                  <div className="pp-requirement-actions">
                    {material.status === "changes" && <button type="button" className="portal-button is-ghost is-small" onClick={() => setEditing(material)}><EditIcon size={14} aria-hidden="true" />Send a revised version</button>}
                    {material.status === "submitted" && <DeleteButton label="Take back" prompt="Take this material back?" confirmLabel="Yes, take it back" pendingLabel="Taking back" action={async () => report(await withdrawMyMaterial(material.id))} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="portal-empty">Nothing sent yet. Every material is approved by the unit before it’s used.</p>}
      </section>
    </div>
  );
}

function MaterialForm({ editing, underParty, partyName, onDone }: { editing: CampaignMaterial | null; underParty: boolean; partyName: string | null; onDone: () => void }) {
  const router = useRouter();
  const id = useId();
  const hydrated = useHydrated();
  const [kind, setKind] = useState<MaterialKind | "">(editing?.kind ?? "");
  const [width, setWidth] = useState(editing?.width ? String(editing.width) : "");
  const [height, setHeight] = useState(editing?.height ? String(editing.height) : "");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const rule = kind ? materialKinds[kind] : null;
  const limit = kind ? sizeLimit(kind, underParty) : null;
  const tooBig = kind && limit && width && height ? sizeProblem(kind, underParty, Number(width), Number(height)) : null;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const packet = new FormData(form);
    packet.delete("files");
    for (const file of files) packet.append("files", file);
    setPending(true);
    try {
      const response = await fetch("/filing/submit/material", { method: "POST", body: packet });
      const result = (await response.json().catch(() => ({ error: "The material couldn’t be sent. Try again." }))) as ActionResult;
      report(result);
      if (response.ok) {
        form.reset();
        setKind("");
        setWidth("");
        setHeight("");
        setFiles([]);
        onDone();
        router.refresh();
      }
    } catch {
      toast("The material couldn’t be sent. Check your connection and try again.", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="portal-card portal-form pp-service-form" onSubmit={submit} noValidate aria-busy={pending}>
      <div className="pp-card-head">
        <h2>{editing ? `Revise “${editing.title}”` : "Send a material"}</h2>
        {editing && <button type="button" className="portal-icon-button" aria-label="Close the revision" title="Close the revision" onClick={onDone}><CloseIcon size={15} aria-hidden="true" /></button>}
      </div>
      {editing && <input type="hidden" name="id" value={editing.id} />}
      <div className="pp-join-grid">
        <div className="portal-field">
          <span className="portal-field-label" id={`${id}-kind`}>Kind{rule && <InfoTip>{`${rule.hint} (${rule.basis})`}</InfoTip>}</span>
          <Dropdown name="kind" options={Object.entries(materialKinds).map(([value, item]) => ({ value, label: item.label }))} value={kind} onChange={(value) => setKind(isMaterialKind(value) ? value : "")} placeholder="Choose a kind" required labelledBy={`${id}-kind`} />
        </div>
        <label className="portal-field">
          <span className="portal-field-label">Name</span>
          <input className="portal-input" name="title" maxLength={200} defaultValue={editing?.title} placeholder="e.g. Classroom poster, week one" autoComplete="off" required />
        </label>
        {limit && (
          <div className={`portal-field is-wide${tooBig ? " has-error" : ""}`}>
            <span className="portal-field-label" id={`${id}-size`}>Size, in {limit.unit === "m" ? "metres" : "inches"}<InfoTip>{`Up to ${limit.label} for ${underParty ? "a party" : "an independent candidate"}, either way up.`}</InfoTip></span>
            <span className="pp-size">
              <input className="portal-input" name="width" type="number" inputMode="decimal" min="0" step="0.01" value={width} onChange={(event) => setWidth(event.target.value)} aria-label="Width" placeholder="Width" required />
              <span aria-hidden="true">×</span>
              <input className="portal-input" name="height" type="number" inputMode="decimal" min="0" step="0.01" value={height} onChange={(event) => setHeight(event.target.value)} aria-label="Height" placeholder="Height" required />
            </span>
            {tooBig && <span className="portal-field-error">{tooBig}</span>}
          </div>
        )}
        {rule && rule.link !== "none" && (
          <label className="portal-field is-wide">
            <span className="portal-field-label">{kind === "page" ? "Page address" : "Where it’s posted (optional)"}</span>
            <input className="portal-input" name="link" type="url" inputMode="url" maxLength={500} defaultValue={editing?.link} placeholder="https://" autoComplete="off" required={rule.link === "required"} />
          </label>
        )}
        {(kind === "tarpaulin" || kind === "poster" || kind === "printed") && (
          <label className="portal-field is-wide">
            <span className="portal-field-label">Where it’ll go{kind === "printed" && " (optional)"}<InfoTip>Only where the unit designates. Nothing outside the university, or in areas it or the university doesn’t allow (Article VII, Section 6).</InfoTip></span>
            <input className="portal-input" name="placement" maxLength={300} defaultValue={editing?.placement} placeholder={kind === "printed" ? "e.g. Handed out at the forum" : "e.g. The bulletin board on the ground floor"} autoComplete="off" required={kind !== "printed"} />
          </label>
        )}
        {underParty && rule?.partyWide && (
          <label className="portal-check is-wide">
            <input type="checkbox" name="showsParty" defaultChecked={editing?.showsParty} required />
            <span>It shows all of {partyName ?? "the party"}’s candidates. A party’s streamers, tarpaulins and posters have no individual versions (Article VII, Section 5).</span>
          </label>
        )}
        {rule && (
          <div className="portal-field is-wide">
            <span className="portal-field-label">{rule.files === "required" && !editing?.files.length ? "A copy of it" : "A copy of it (optional)"}<InfoTip>{`PDF, JPG or PNG, up to 10 MB each, ${MAX_MATERIAL_FILES} files at most.${editing?.files.length ? " Attach new files to replace the ones sent before; attach none to keep them." : ""}`}</InfoTip></span>
            <div className="pp-requirement-actions">
              <label className={`portal-button is-ghost is-small pp-upload${pending ? " is-busy" : ""}`}>
                <input className="portal-visually-hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={pending} aria-label="Attach a copy" onChange={(event) => { const chosen = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; setFiles((list) => [...list, ...chosen].slice(0, MAX_MATERIAL_FILES)); }} />
                <Upload size={14} aria-hidden="true" />{files.length ? "Add more files" : "Attach files"}
              </label>
            </div>
            {files.length > 0 && (
              <ul className="pp-files" aria-label="Files to send">
                {files.map((file, index) => (
                  <li key={`${file.name}-${index}`}><FileText size={15} aria-hidden="true" /><span className="pp-file-name"><span>{file.name}</span><small>{megabytes(file.size)}</small></span>
                    <button type="button" className="portal-icon-button" aria-label={`Delete ${file.name}`} title={`Delete ${file.name}`} onClick={() => setFiles((list) => list.filter((_, at) => at !== index))}><CloseIcon size={14} aria-hidden="true" /></button></li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated || Boolean(tooBig)}><Send size={15} aria-hidden="true" />{pending ? <Busy>Sending</Busy> : editing ? "Send revised version" : "Send for approval"}</button>
      </div>
    </form>
  );
}

/* Schedule */

/**
 * `changeable` and `cancellable` are worked out on the server: an activity changes with five hours'
 * notice, and is cancelled any time before it starts. `open`: the candidate is qualified.
 */
export function ScheduleBoard({ activities, changeable, cancellable, moratoriums, unit, open }: { activities: CampaignActivity[]; changeable: string[]; cancellable: string[]; moratoriums: CalendarHighlight[]; unit: string; open: boolean }) {
  const [editing, setEditing] = useState<CampaignActivity | null>(null);
  const upcoming = activities.filter((activity) => activity.status !== "cancelled");
  const cancelled = activities.filter((activity) => activity.status === "cancelled");
  return (
    <div className={`pp-service-grid${open ? "" : " is-single"}`}>
      {open && <ActivityForm key={editing?.id ?? "new"} editing={editing} moratoriums={moratoriums} onDone={() => setEditing(null)} />}
      <section className="portal-card pp-service-side" aria-labelledby="schedule-list">
        <h2 id="schedule-list">Your schedule</h2>
        {upcoming.length || cancelled.length ? (
          <ul className="pp-service-list">
            {[...upcoming, ...cancelled].map((activity) => (
              <li key={activity.id} className={editing?.id === activity.id ? "is-editing" : undefined}>
                <div className="pp-service-head">
                  <div><strong>{activity.title}</strong><small>{activityKinds[activity.kind].label}</small></div>
                  <span className={`portal-tag ${activityStatusTone[activity.status]}`}>{activityStatusLabel[activity.status]}</span>
                </div>
                <dl className="portal-details pp-service-details">
                  <div><dt>When</dt><dd><CalendarClock size={13} aria-hidden="true" /> {formatSlot(activity.startsAt, activity.endsAt)}</dd></div>
                  <div><dt>Where</dt><dd><MapPin size={13} aria-hidden="true" /> {activity.venue}</dd></div>
                  {activity.details && <div><dt>Details</dt><dd>{activity.details}</dd></div>}
                </dl>
                {activity.feedback && <Feedback text={activity.feedback} warn={activity.status === "declined"} unit={unit} at={activity.reviewedAt} />}
                {open && cancellable.includes(activity.id) && (
                  <div className="pp-requirement-actions">
                    {changeable.includes(activity.id) && <button type="button" className="portal-button is-ghost is-small" onClick={() => setEditing(activity)}><EditIcon size={14} aria-hidden="true" />Change</button>}
                    <DeleteButton label="Cancel activity" prompt={changeable.includes(activity.id) ? "Cancel this activity?" : `It’s under ${NOTICE_HOURS} hours away. Cancel anyway?`} confirmLabel="Yes, cancel" pendingLabel="Cancelling" action={async () => report(await cancelMyActivity(activity.id))} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="portal-empty">Nothing on your schedule yet. Add where and when you’ll campaign; the unit approves each activity.</p>}
      </section>
    </div>
  );
}

function ActivityForm({ editing, moratoriums, onDone }: { editing: CampaignActivity | null; moratoriums: CalendarHighlight[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<CampaignState, FormData>(saveActivity.bind(null, editing?.id ?? null, editing?.updatedAt ?? null), undefined);
  useToast(state?.error, "error", state);
  useToast(state?.ok, "ok", state);
  // Sent: the form starts again empty, and a change closes back to adding.
  const [round, setRound] = useState(0);
  const [seen, setSeen] = useState(state);
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setRound((value) => value + 1);
  }
  const editingId = editing?.id;
  useEffect(() => {
    if (state?.ok && editingId) onDone();
  }, [state, editingId, onDone]);
  const hydrated = useHydrated();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };
  return (
    <form className="portal-card portal-form pp-service-form" onSubmit={onSubmit} noValidate>
      <div className="pp-card-head">
        <h2>{editing ? `Change “${editing.title}”` : "Add an activity"}</h2>
        {editing && <button type="button" className="portal-icon-button" aria-label="Close the change" title="Close the change" onClick={onDone}><CloseIcon size={15} aria-hidden="true" /></button>}
      </div>
      <ActivityFields key={round} editing={editing} moratoriums={moratoriums} errors={state?.fieldErrors ?? {}} />
      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated}><Send size={15} aria-hidden="true" />{pending ? <Busy>Sending</Busy> : editing ? "Send the change" : "Add to schedule"}</button>
      </div>
    </form>
  );
}

function ActivityFields({ editing, moratoriums, errors }: { editing: CampaignActivity | null; moratoriums: CalendarHighlight[]; errors: Record<string, string> }) {
  const id = useId();
  const [kind, setKind] = useState<ActivityKind | "">(editing?.kind ?? "");
  const [date, setDate] = useState(editing ? manilaParts(editing.startsAt)[0] : "");
  const [start, setStart] = useState(editing ? manilaParts(editing.startsAt)[1] : "");
  const [end, setEnd] = useState(editing ? manilaParts(editing.endsAt)[1] : "");
  return (
    <div className="pp-join-grid">
      <div className={`portal-field${errors.kind ? " has-error" : ""}`}>
        <span className="portal-field-label" id={`${id}-kind`}>Kind{kind && <InfoTip>{activityKinds[kind].hint}</InfoTip>}</span>
        <Dropdown name="kind" options={Object.entries(activityKinds).map(([value, item]) => ({ value, label: item.label }))} value={kind} onChange={(value) => setKind(value as ActivityKind)} placeholder="Choose a kind" required invalid={Boolean(errors.kind)} labelledBy={`${id}-kind`} />
        {errors.kind && <span className="portal-field-error">{errors.kind}</span>}
      </div>
      <label className={`portal-field${errors.title ? " has-error" : ""}`}>
        <span className="portal-field-label">Name</span>
        <input className="portal-input" name="title" maxLength={200} defaultValue={editing?.title} placeholder="e.g. Room-to-room, St. Raymund’s Building" autoComplete="off" required />
        {errors.title && <span className="portal-field-error">{errors.title}</span>}
      </label>
      <label className={`portal-field is-wide${errors.venue ? " has-error" : ""}`}>
        <span className="portal-field-label">Where</span>
        <input className="portal-input" name="venue" maxLength={300} defaultValue={editing?.venue} placeholder={kind === "online" ? "The platform and the page" : "The building and rooms"} autoComplete="off" required />
        {errors.venue && <span className="portal-field-error">{errors.venue}</span>}
      </label>
      <div className={`portal-field${errors.date ? " has-error" : ""}`}>
        <span className="portal-field-label" id={`${id}-date`}>Day<InfoTip>No-campaign days are marked in the picker. An activity can’t be on one.</InfoTip></span>
        <DatePicker name="date" value={date} onChange={setDate} min={manilaDay()} highlights={moratoriums} required invalid={Boolean(errors.date)} label="Day" />
        {errors.date && <span className="portal-field-error">{errors.date}</span>}
      </div>
      <div className={`portal-field${errors.start ? " has-error" : ""}`}>
        <span className="portal-field-label" id={`${id}-start`}>Starts<InfoTip>{`The unit needs ${NOTICE_HOURS} hours’ notice of an activity or a change to it, not counting midnight to 6 a.m. (Article VII, Section 1.3).`}</InfoTip></span>
        <TimePicker name="start" value={start} onChange={setStart} invalid={Boolean(errors.start)} labelledBy={`${id}-start`} suggest="09:00" />
        {errors.start && <span className="portal-field-error">{errors.start}</span>}
      </div>
      <div className={`portal-field${errors.end ? " has-error" : ""}`}>
        <span className="portal-field-label" id={`${id}-end`}>Ends</span>
        <TimePicker name="end" value={end} onChange={setEnd} invalid={Boolean(errors.end)} labelledBy={`${id}-end`} suggest="10:00" />
        {errors.end && <span className="portal-field-error">{errors.end}</span>}
      </div>
      <label className={`portal-field is-wide${errors.details ? " has-error" : ""}`}>
        <span className="portal-field-label">Details (optional)</span>
        <textarea name="details" rows={3} maxLength={2000} defaultValue={editing?.details} placeholder="Who’ll be there, and what you’ll do" />
        {errors.details && <span className="portal-field-error">{errors.details}</span>}
      </label>
    </div>
  );
}

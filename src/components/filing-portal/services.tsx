"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useId, useRef, useState, type FormEvent } from "react";
import { FileText, MapPin, MessageSquareText, Monitor, Send, Upload, Users } from "lucide-react";
import { CloseIcon } from "@/components/action-icons";
import { DraftNotice } from "@/components/draft-notice";
import { DatePicker } from "@/components/portal/date-picker";
import { DeleteButton } from "@/components/portal/delete-button";
import { Dropdown, optionsOf, type DropdownOption } from "@/components/portal/dropdown";
import { InfoTip } from "@/components/portal/info-tip";
import { useHydrated } from "@/components/portal/portal-form";
import { SlidingSegments } from "@/components/portal/sliding-filters";
import { TimePicker } from "@/components/portal/time-picker";
import { toast, useToast } from "@/components/portal/toast";
import { useFormDraft } from "@/components/use-form-draft";
import { bookConsultation, cancelMyRequest, requestCommissioner, withdrawMyPetition, type ActionResult, type ServiceState } from "@/lib/filing-portal/services-actions";
import {
  CONSULTATION_MINUTES, MAX_PETITION_FILES, PETITION_DEADLINE_SCHOOL_DAYS, commissionerRoles, consultationTopics, formatSlot, isPetitionType, petitionStatusLabel, petitionStatusTone,
  petitionTypes, requestModes, requestStatusLabel, requestStatusTone, schoolDaysBetween, topicLabel, type FilingRequest, type OnBehalf, type Petition, type PetitionType, type RequestKind, type RequestMode,
} from "@/lib/filing-portal/services";
import "./documents.css";
import { Busy } from "@/components/busy";

// The filing portal's Services: the forms to book a consultation, ask for a commissioner and file a
// petition, and the lists of what the account has asked and filed, with where each stands.

const report = (result: ActionResult) => toast(result.error ?? result.ok ?? "Done.", result.error ? "error" : "ok");
const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
const when = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));
const manilaDay = (offsetDays = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(Date.now() + offsetDays * 86_400_000));

/** A picker's field: its label (named for the validation tooltip), the picker, and its error. */
function PickerField({ label, error, hint, wide, children, id }: { label: string; error?: string; hint?: string; wide?: boolean; children: React.ReactNode; id: string }) {
  return (
    <div className={`portal-field${wide ? " is-wide" : ""}${error ? " has-error" : ""}`}>
      <span className="portal-field-label" id={id}>{label}{hint && <InfoTip>{hint}</InfoTip>}</span>
      {children}
      {error && <span className="portal-field-error">{error}</span>}
    </div>
  );
}

function TextField({ label, name, error, hint, wide, optional, multiline, ...props }: { label: string; name: string; error?: string; hint?: string; wide?: boolean; optional?: boolean; multiline?: boolean; maxLength: number; placeholder?: string; minLength?: number; rows?: number }) {
  return (
    <label className={`portal-field${wide ? " is-wide" : ""}${error ? " has-error" : ""}`}>
      <span className="portal-field-label">{label}{optional && " (optional)"}{hint && <InfoTip>{hint}</InfoTip>}</span>
      {multiline ? <textarea name={name} required={!optional} rows={props.rows ?? 4} {...props} /> : <input className="portal-input" name={name} required={!optional} autoComplete="off" {...props} />}
      {error && <span className="portal-field-error">{error}</span>}
    </label>
  );
}

export type UnitOption = { value: string; label: string };
export type BehalfOption = { value: OnBehalf; label: string };

/** Book a consultation, or ask for a commissioner: the same form, with what each needs. Sent, it starts again empty. */
export function RequestForm({ kind, units, behalf }: { kind: RequestKind; units: UnitOption[]; behalf: BehalfOption[] }) {
  const [state, formAction, pending] = useActionState<ServiceState, FormData>(kind === "consultation" ? bookConsultation : requestCommissioner, undefined);
  useToast(state?.error, "error", state);
  useToast(state?.ok, "ok", state);
  const hydrated = useHydrated();
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };
  return (
    <form className="portal-card portal-form pp-service-form" onSubmit={onSubmit} noValidate>
      <RequestFields key={state?.sentAt ?? 0} kind={kind} units={units} behalf={behalf} errors={state?.fieldErrors ?? {}} />
      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated}><Send size={15} aria-hidden="true" />{pending ? <Busy>Sending</Busy> : kind === "consultation" ? "Book consultation" : "Send request"}</button>
      </div>
    </form>
  );
}

function RequestFields({ kind, units, behalf, errors }: { kind: RequestKind; units: UnitOption[]; behalf: BehalfOption[]; errors: Record<string, string> }) {
  const id = useId();
  const [unit, setUnit] = useState(units.length === 1 ? units[0].value : "");
  const [onBehalf, setOnBehalf] = useState<string>(behalf.length === 1 ? behalf[0].value : "");
  const [topic, setTopic] = useState("");
  const [mode, setMode] = useState<RequestMode>("in-person");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [end, setEnd] = useState("");
  const [minutes, setMinutes] = useState("30");
  const consultation = kind === "consultation";
  const topics = optionsOf(consultation ? consultationTopics : commissionerRoles);

  return (
    <div className="pp-join-grid">
      <PickerField id={`${id}-unit`} label="Unit" error={errors.unit} hint="The Central Comelec, or a college’s Comelec unit: yours, your party’s or your candidacy’s.">
        <Dropdown name="unit" options={units} value={unit} onChange={setUnit} placeholder="Choose a unit" required invalid={Boolean(errors.unit)} labelledBy={`${id}-unit`} />
      </PickerField>
      {behalf.length > 1 ? (
        <PickerField id={`${id}-behalf`} label="For" error={errors.onBehalf}>
          <Dropdown name="onBehalf" options={behalf} value={onBehalf} onChange={setOnBehalf} placeholder="Choose whom it’s for" required invalid={Boolean(errors.onBehalf)} labelledBy={`${id}-behalf`} />
        </PickerField>
      ) : <input type="hidden" name="onBehalf" value={behalf[0]?.value ?? "self"} />}
      {consultation ? (
        <>
          <PickerField id={`${id}-topic`} label="About" error={errors.topic}>
            <Dropdown name="topic" options={topics} value={topic} onChange={setTopic} placeholder="Choose a topic" required invalid={Boolean(errors.topic)} labelledBy={`${id}-topic`} />
          </PickerField>
          <TextField label="Your question, in a line" name="subject" error={errors.subject} maxLength={200} placeholder="e.g. Which documents a transferee files" wide />
        </>
      ) : (
        <>
          <TextField label="Activity" name="subject" error={errors.subject} maxLength={200} placeholder="e.g. General assembly and election of officers" />
          <PickerField id={`${id}-topic`} label="The commissioner is asked to" error={errors.topic}>
            <Dropdown name="topic" options={topics} value={topic} onChange={setTopic} placeholder="Choose one" required invalid={Boolean(errors.topic)} labelledBy={`${id}-topic`} />
          </PickerField>
        </>
      )}
      <div className={`portal-field is-wide${errors.mode ? " has-error" : ""}`}>
        <span className="portal-field-label" id={`${id}-mode`}>How</span>
        <SlidingSegments active={mode} role="radiogroup" aria-labelledby={`${id}-mode`}>
          {(Object.keys(requestModes) as RequestMode[]).map((value) => (
            <label key={value} className={`portal-segment${mode === value ? " is-selected" : ""}`}>
              <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
              {value === "online" ? <Monitor size={15} aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}{requestModes[value]}
            </label>
          ))}
        </SlidingSegments>
        {errors.mode && <span className="portal-field-error">{errors.mode}</span>}
      </div>
      {!consultation && <TextField label={mode === "online" ? "Platform or meeting link" : "Where"} name="venue" error={errors.venue} maxLength={300} placeholder={mode === "online" ? "e.g. Google Meet, and the link" : "Building and room"} wide />}
      <PickerField id={`${id}-date`} label="Day" error={errors.date} hint={consultation ? "Monday to Saturday, a day ahead at least." : "Three days ahead at least, so the unit can send someone."}>
        <DatePicker name="date" value={date} onChange={setDate} min={manilaDay(consultation ? 1 : 3)} required invalid={Boolean(errors.date)} label="Day" />
      </PickerField>
      <PickerField id={`${id}-time`} label={consultation ? "Time" : "Starts"} error={consultation ? errors.time : errors.start} hint={consultation ? "Between 8:00 a.m. and 5:00 p.m., Manila time." : undefined}>
        <TimePicker name={consultation ? "time" : "start"} value={time} onChange={setTime} invalid={Boolean(consultation ? errors.time : errors.start)} labelledBy={`${id}-time`} suggest="09:00" />
      </PickerField>
      {consultation ? (
        <PickerField id={`${id}-minutes`} label="How long" error={errors.minutes}>
          <Dropdown name="minutes" options={CONSULTATION_MINUTES.map((value) => ({ value: String(value), label: value === 60 ? "1 hour" : `${value} minutes` }))} value={minutes} onChange={setMinutes} required invalid={Boolean(errors.minutes)} labelledBy={`${id}-minutes`} />
        </PickerField>
      ) : (
        <PickerField id={`${id}-end`} label="Ends" error={errors.end}>
          <TimePicker name="end" value={end} onChange={setEnd} invalid={Boolean(errors.end)} labelledBy={`${id}-end`} suggest="12:00" />
        </PickerField>
      )}
      <TextField label={consultation ? "Anything the unit should know first" : "Details"} name="details" error={errors.details} maxLength={3000} optional multiline rows={3} placeholder={consultation ? "What you’ve done so far, and what you’re unsure of" : "What happens at the activity, and who’ll be there"} wide />
    </div>
  );
}

/** What the account has asked for, newest first, with where each stands. `cancellable`: worked out on the server. */
export function RequestList({ requests, cancellable, unitNames, empty }: { requests: FilingRequest[]; cancellable: string[]; unitNames: Record<string, string>; empty: string }) {
  if (!requests.length) return <p className="portal-empty">{empty}</p>;
  return (
    <ul className="pp-service-list">
      {requests.map((request) => {
        const confirmed = request.status === "confirmed" || (request.status === "done" && request.confirmedStart);
        return (
          <li key={request.id} id={`request-${request.id}`}>
            <div className="pp-service-head">
              <div>
                <strong>{request.subject}</strong>
                <small>{request.reference} · {topicLabel(request)} · {unitNames[request.college] ?? request.college}{request.partyName && request.onBehalf === "party" ? ` · For ${request.partyName}` : ""}</small>
              </div>
              <span className={`portal-tag ${requestStatusTone[request.status]}`}>{requestStatusLabel[request.status]}</span>
            </div>
            <dl className="portal-details pp-service-details">
              <div><dt>Asked for</dt><dd>{formatSlot(request.startsAt, request.endsAt)} · {requestModes[request.mode]}{request.venue ? ` · ${request.venue}` : ""}</dd></div>
              {confirmed && <div><dt>Confirmed</dt><dd>{formatSlot(request.confirmedStart ?? request.startsAt, request.confirmedEnd ?? request.endsAt)}</dd></div>}
              {confirmed && request.location && <div><dt>Where</dt><dd><MapPin size={13} aria-hidden="true" /> {request.location}</dd></div>}
              {confirmed && request.assigned && <div><dt>{request.kind === "consultation" ? "With" : "Commissioner"}</dt><dd>{request.assigned}</dd></div>}
            </dl>
            {request.response && (
              <div className={`pp-feedback${request.status === "declined" ? " is-changes" : ""}`}>
                <MessageSquareText size={16} aria-hidden="true" />
                <div><strong>{unitNames[request.college] ?? "The unit"} wrote</strong><p>{request.response}</p>{request.handledAt && <small>{when(request.handledAt)}</small>}</div>
              </div>
            )}
            {cancellable.includes(request.id) && (
              <div className="pp-requirement-actions">
                <DeleteButton label="Cancel request" prompt="Cancel this request?" confirmLabel="Yes, cancel" pendingLabel="Cancelling" action={async () => report(await cancelMyRequest(request.id))} />
                <small className="pp-requirement-when">Sent {when(request.createdAt)}</small>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** File a petition or a case: kept on this device for an hour while it's written, files aside. */
export function PetitionForm({ units, draftKey }: { units: UnitOption[]; draftKey: string }) {
  const router = useRouter();
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [unit, setUnit] = useState(units.length === 1 ? units[0].value : "");
  const [type, setType] = useState<PetitionType | "">("");
  const [occurredOn, setOccurredOn] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hydrated = useHydrated();
  const draft = useFormDraft({
    key: draftKey,
    form: formRef,
    state: { unit, type, occurredOn },
    restore: (saved) => {
      if (saved.unit) setUnit(saved.unit);
      if (isPetitionType(saved.type)) setType(saved.type);
      if (saved.occurredOn) setOccurredOn(saved.occurredOn);
    },
  });
  const rule = type ? petitionTypes[type] : null;
  const today = manilaDay();
  const late = Boolean(rule?.deadline && occurredOn && schoolDaysBetween(occurredOn, today) > PETITION_DEADLINE_SCHOOL_DAYS);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const packet = new FormData(event.currentTarget);
    packet.delete("files");
    for (const file of files) packet.append("files", file);
    setPending(true);
    setErrors({});
    try {
      const response = await fetch("/filing/submit/petition", { method: "POST", body: packet });
      const result = (await response.json().catch(() => ({ error: "The petition couldn’t be filed. Try again." }))) as ActionResult;
      report(result);
      if (response.ok) {
        draft.clear();
        formRef.current?.reset();
        setUnit(units.length === 1 ? units[0].value : "");
        setType("");
        setOccurredOn("");
        setFiles([]);
        router.refresh();
      }
    } catch {
      toast("The petition couldn’t be filed. Check your connection and try again. Your answers are kept on this device.", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <form ref={formRef} className="portal-card portal-form pp-service-form" onSubmit={submit} noValidate aria-busy={pending}>
      <DraftNotice draft={draft} buttonClassName="portal-button is-ghost is-small" actionClassName="portal-button" note="Attachments aren’t kept on this device. Add them again before you file." />
      <div className="pp-join-grid">
        <PickerField id={`${id}-unit`} label="File with" error={errors.unit} hint="Qualification contests about a Central Student Council candidate go to the Central Comelec; about a Local Student Council candidate, to that college’s unit (Article VI, Section 8).">
          <Dropdown name="unit" options={units} value={unit} onChange={setUnit} placeholder="Choose a unit" required labelledBy={`${id}-unit`} />
        </PickerField>
        <PickerField id={`${id}-type`} label="What you’re filing" hint={Object.values(petitionTypes).map((item) => `${item.label}: ${item.hint} (${item.basis})`).join(" ")}>
          <Dropdown name="type" options={Object.entries(petitionTypes).map(([value, item]): DropdownOption => ({ value, label: item.label }))} value={type} onChange={(value) => setType(isPetitionType(value) ? value : "")} placeholder="Choose one" required labelledBy={`${id}-type`} />
        </PickerField>
        <TextField label="What it’s about, in a line" name="subject" maxLength={200} placeholder="e.g. Posters put up outside the designated areas" wide />
        <TextField label={rule ? `Against: ${rule.respondent.toLowerCase()}` : "Against"} name="respondent" maxLength={200} optional placeholder="A candidate, a party, or anyone else" />
        <PickerField id={`${id}-day`} label="When it happened (optional)" hint={`Election protests and offenses are filed within ${PETITION_DEADLINE_SCHOOL_DAYS} school days of what happened (Article XII, Section 4).`}>
          <DatePicker name="occurredOn" value={occurredOn} onChange={setOccurredOn} max={today} label="When it happened" />
        </PickerField>
        {late && (
          <div className="pp-feedback is-changes is-wide" role="status">
            <MessageSquareText size={16} aria-hidden="true" />
            <div><strong>It’s past {PETITION_DEADLINE_SCHOOL_DAYS} school days</strong><p>The Code asks for this within {PETITION_DEADLINE_SCHOOL_DAYS} school days of what happened, so the unit may dismiss it for that. You can still file it.</p></div>
          </div>
        )}
        <TextField label="What happened" name="statement" maxLength={8000} minLength={30} multiline rows={7} placeholder="Who did what, when and where, and how you know" wide hint="Stick to the facts, in order. The unit sends a copy to whoever it’s against, who answers within five school days (Article XII, Section 5)." />
        <TextField label="What you ask the unit to do" name="relief" maxLength={2000} optional multiline rows={3} placeholder="e.g. Order the posters taken down, and penalise the party" wide />
        <div className="portal-field is-wide">
          <span className="portal-field-label">Evidence (optional)<InfoTip>Photos, screenshots, documents: PDF, JPG or PNG, up to 10 MB each, {MAX_PETITION_FILES} files at most.</InfoTip></span>
          <div className="pp-requirement-actions">
            <label className={`portal-button is-ghost is-small pp-upload${pending ? " is-busy" : ""}`}>
              <input className="portal-visually-hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={pending} aria-label="Attach evidence" onChange={(event) => { const chosen = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; setFiles((list) => [...list, ...chosen].slice(0, MAX_PETITION_FILES)); }} />
              <Upload size={14} aria-hidden="true" />{files.length ? "Add more files" : "Attach files"}
            </label>
          </div>
          {files.length > 0 && (
            <ul className="pp-files" aria-label="Evidence to attach">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  <FileText size={15} aria-hidden="true" />
                  <span className="pp-file-name"><span>{file.name}</span><small>{megabytes(file.size)}</small></span>
                  <button type="button" className="portal-icon-button" aria-label={`Delete ${file.name}`} title={`Delete ${file.name}`} onClick={() => setFiles((list) => list.filter((_, at) => at !== index))}><CloseIcon size={14} aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="portal-check is-wide">
          <input type="checkbox" name="certify" required />
          <span>I certify that what I wrote is true and correct to the best of my knowledge, and I can be asked to swear to it.</span>
        </label>
      </div>
      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated}><Send size={15} aria-hidden="true" />{pending ? <Busy>Filing</Busy> : "File petition"}</button>
      </div>
    </form>
  );
}

/** What the account has filed, newest first. */
export function PetitionList({ petitions, unitNames }: { petitions: Petition[]; unitNames: Record<string, string> }) {
  if (!petitions.length) return <p className="portal-empty">You haven’t filed a petition.</p>;
  return (
    <ul className="pp-service-list">
      {petitions.map((petition) => (
        <li key={petition.id}>
          <div className="pp-service-head">
            <div>
              <strong>{petition.subject}</strong>
              <small>{petition.reference} · {petitionTypes[petition.type].label} · {unitNames[petition.college] ?? petition.college}</small>
            </div>
            <span className={`portal-tag ${petitionStatusTone[petition.status]}`}>{petitionStatusLabel[petition.status]}</span>
          </div>
          <dl className="portal-details pp-service-details">
            <div><dt>Filed</dt><dd>{when(petition.createdAt)}</dd></div>
            {petition.respondent && <div><dt>Against</dt><dd>{petition.respondent}</dd></div>}
            {petition.docketedAt && <div><dt>Docketed</dt><dd>{when(petition.docketedAt)}</dd></div>}
            {petition.decidedAt && (petition.status === "resolved" || petition.status === "dismissed") && <div><dt>{petition.status === "resolved" ? "Resolved" : "Dismissed"}</dt><dd>{when(petition.decidedAt)}</dd></div>}
          </dl>
          {petition.remarks && (
            <div className={`pp-feedback${petition.status === "dismissed" ? " is-changes" : ""}`}>
              <MessageSquareText size={16} aria-hidden="true" />
              <div><strong>{unitNames[petition.college] ?? "The unit"} wrote</strong><p>{petition.remarks}</p></div>
            </div>
          )}
          {petition.files.length > 0 && (
            <ul className="pp-files" aria-label={`Evidence for ${petition.reference}`}>
              {petition.files.map((file, index) => (
                <li key={file.path}><FileText size={15} aria-hidden="true" /><span className="pp-file-name"><a href={`/filing/files/petition/${petition.id}/${index}`} target="_blank" rel="noopener noreferrer">{file.name}</a><small>{megabytes(file.size)}</small></span></li>
              ))}
            </ul>
          )}
          {(petition.status === "filed" || petition.status === "docketed") && (
            <div className="pp-requirement-actions">
              <DeleteButton label="Withdraw petition" prompt="Withdraw this petition?" confirmLabel="Yes, withdraw" pendingLabel="Withdrawing" action={async () => report(await withdrawMyPetition(petition.id))} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

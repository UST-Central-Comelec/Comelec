"use client";

import { startTransition, useActionState, useId, useMemo, useState } from "react";
import { CalendarClock, FlaskConical, Send } from "lucide-react";
import { formatClosing, fromManilaInput } from "@/lib/applications/period";
import { unitAbbreviations } from "@/lib/applications/options";
import { accountPositions } from "@/lib/data/types";
import { audienceBodies, audiencePositions, audienceRoles, describeAudience, describeUnit, localUnit, matchedPeople, type Audience, type AudienceGroup, type Person, type Reach } from "@/lib/email/audience";
import { bodyDocument, isEmptyBody, messageHtml, type MessageBody, type Sender } from "@/lib/email/body";
import { LOGO_PATH } from "@/lib/email/template";
import type { EmailFormState } from "@/lib/portal/email-actions";
import type { DropdownOption } from "./dropdown";
import { DateTimePicker } from "./date-time-picker";
import { MultiDropdown } from "./multi-dropdown";
import { DocumentBodyField } from "./document-body-field";
import { EmailPreview } from "./email-preview";
import { InfoTip } from "./info-tip";
import { useHydrated } from "./portal-form";

type Action = (state: EmailFormState, formData: FormData) => Promise<EmailFormState>;

export type ComposerDraft = { subject: string; title: string; body: MessageBody; audience: Audience; sendToEmail?: boolean; sendToInbox?: boolean };

/** "Who": the positions, then the commission's two bodies. */
const groupOptions: DropdownOption[] = [...Object.entries(audiencePositions).map(([value, label]) => ({ value, label, group: "Positions" })), ...Object.entries(audienceBodies).map(([value, label]) => ({ value, label, group: "Bodies" }))];

/** "42 recipients", "1 recipient". */
const countOf = (count: number) => `${count} ${count === 1 ? "recipient" : "recipients"}`;

/**
 * Apps → Email Sender: who it's for, what it says, and when it goes, beside the email as its
 * recipients will see it.
 *
 * `people` are the active accounts within the sender's reach; who the filters match is worked out
 * from them here, and again on the server when the email goes out. Unit, Who (positions, and the
 * bodies En Banc and the Chamber of Chairpersons) and Role take several choices each, and People narrows what they match to a hand-picked set. `units` are the
 * Local Comelecs that can be picked; a Local account has only its own (`lockedUnit`).
 */
export function EmailComposer({ action, testAction, people, units, reach, lockedUnit, sender, fromName, draft, sendAtDefault, sendAtMin }: {
  action: Action;
  testAction: Action;
  people: Person[];
  units: readonly string[];
  reach: Reach;
  lockedUnit: string | null;
  sender: Sender;
  fromName: string;
  draft: ComposerDraft;
  /** Manila wall-clock values for the schedule field: where it starts, and the earliest it takes. */
  sendAtDefault: string;
  sendAtMin: string;
}) {
  const id = useId();
  const hydrated = useHydrated();
  const [state, send, sending] = useActionState(action, undefined);
  const [testState, sendTest, testing] = useActionState(testAction, undefined);

  const [audience, setAudience] = useState<Audience>(draft.audience);
  const [subject, setSubject] = useState(draft.subject);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(() => bodyDocument(draft.body));
  const [when, setWhen] = useState<"now" | "later">("now");
  const [sendAt, setSendAt] = useState(sendAtDefault);
  const [sendToEmail, setSendToEmail] = useState(draft.sendToEmail ?? true);
  const [sendToInbox, setSendToInbox] = useState(draft.sendToInbox ?? true);
  const [armed, setArmed] = useState(false);
  // Which of the two buttons spoke last, so only its message shows.
  const [last, setLast] = useState<"send" | "test">("send");

  const matched = useMemo(() => matchedPeople(audience, people, reach), [audience, people, reach]);
  // Anyone picked by hand who no longer matches the filters isn't a recipient, and is dropped when the email is sent.
  const only = audience.only.filter((email) => matched.some((person) => person.email === email));
  const recipients = only.length ? matched.filter((person) => only.includes(person.email)) : matched;
  const current = { ...audience, only };
  const html = useMemo(() => messageHtml({ subject, title, body }, sender, LOGO_PATH), [subject, title, body, sender]);
  const shown = last === "send" ? state : testState;
  const errors = shown?.fieldErrors ?? {};
  const pending = sending || testing;

  const unitOptions: DropdownOption[] = lockedUnit
    ? [{ value: lockedUnit, label: describeUnit(lockedUnit) }]
    : [
        { value: "central", label: "Central Comelec" },
        { value: "local", label: "All Local Comelecs" },
        { value: "osa", label: "Office for Student Affairs" },
        ...units.map((unit) => ({ value: localUnit(unit), label: unitAbbreviations[unit] ? `${unit} (${unitAbbreviations[unit]})` : unit, group: "Local Comelecs" })),
      ];
  const roles = audienceRoles(audience.groups);
  const roleOptions: DropdownOption[] = [...roles.board.map((role) => ({ value: role, label: role, group: "Executive Board" })), ...roles.offices.map((role) => ({ value: role, label: role, group: "Executive Associates" }))];
  const peopleOptions: DropdownOption[] = matched.map((person) => ({ value: person.email, label: `${person.name} · ${person.kind === "official" ? "Official account" : person.role || accountPositions[person.position]}${unitOfPerson(person)}` }));

  const change = (next: Partial<Audience>) => {
    setArmed(false);
    setAudience((current) => {
      const merged = { ...current, ...next };
      // Roles that the positions now picked don't have are dropped.
      const { board, offices } = audienceRoles(merged.groups);
      return { ...merged, roles: merged.roles.filter((role) => board.includes(role) || offices.includes(role)) };
    });
  };

  const form = () => {
    const data = new FormData();
    data.set("subject", subject);
    data.set("title", title);
    data.set("body", JSON.stringify(body));
    data.set("audience", JSON.stringify(current));
    data.set("when", when);
    data.set("sendAt", sendAt);
    if (sendToEmail) data.set("sendToEmail", "on");
    if (sendToInbox) data.set("sendToInbox", "on");
    return data;
  };

  const submit = () => {
    setLast("send");
    setArmed(false);
    startTransition(() => send(form()));
  };
  const test = () => {
    setLast("test");
    setArmed(false);
    startTransition(() => sendTest(form()));
  };

  const scheduledFor = when === "later" ? fromManilaInput(sendAt) : null;
  const ready = subject.trim().length >= 3 && !isEmptyBody(body) && (sendToEmail || sendToInbox);
  const to = recipients.length ? `${countOf(recipients.length)} · ${describeAudience(current)}` : "Nobody matches yet";

  return (
    <div className="email-compose">
      <form
        className="portal-card portal-form email-compose-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          // Sending now can't be taken back, so it asks once; a scheduled email can still be cancelled.
          if (when === "now" && !armed) setArmed(true);
          else submit();
        }}
      >
        <fieldset className={`portal-form-section${errors.audience ? " has-error" : ""}`}>
          <legend>Recipients</legend>
          <div className="portal-form-grid">
            <div className="portal-field">
              <span className="portal-field-label" id={`${id}-unit`}>Unit<InfoTip>{lockedUnit ? "A Local Comelec’s emails go to its own unit." : "Tick one or more: the Central Comelec, every Local Comelec, particular colleges’ Local Comelecs, or the Office for Student Affairs. With none ticked it goes to every unit."}</InfoTip></span>
              <MultiDropdown options={unitOptions} values={lockedUnit ? [lockedUnit] : audience.units} onChange={(picked) => change({ units: picked })} placeholder="All units" clearLabel="All units" disabled={Boolean(lockedUnit)} labelledBy={`${id}-unit`} />
            </div>
            <div className="portal-field">
              <span className="portal-field-label" id={`${id}-group`}>Who<InfoTip>Tick one or more positions, or a body: En Banc is the Central Executive Board and every college’s Central Representative, and the Chamber of Chairpersons is every Local Comelec’s Chairperson. With none ticked it goes to all commissioners: the Executive Board, Executive Associates and Deputies. Advisers and Admins only get it when ticked.</InfoTip></span>
              <MultiDropdown options={groupOptions} values={audience.groups} onChange={(picked) => change({ groups: picked as AudienceGroup[] })} placeholder="All commissioners" clearLabel="All commissioners" labelledBy={`${id}-group`} />
            </div>
            <div className="portal-field">
              <span className="portal-field-label" id={`${id}-role`}>Role<InfoTip>Narrows it to the people holding the roles ticked, such as every Secretary to the Executive. Deputies, Advisers and Admins have no roles to pick from.</InfoTip></span>
              <MultiDropdown options={roleOptions} values={audience.roles} onChange={(picked) => change({ roles: picked })} placeholder="Any role" clearLabel="Any role" disabled={!roleOptions.length} labelledBy={`${id}-role`} />
            </div>
            <div className="portal-field">
              <span className="portal-field-label" id={`${id}-people`}>People<InfoTip>Tick particular people to send it only to them. The list holds everyone the other three match, so widen those to reach someone who isn’t listed. With none ticked it goes to all of them.</InfoTip></span>
              <MultiDropdown options={peopleOptions} values={only} onChange={(picked) => change({ only: picked })} placeholder={matched.length ? `Everyone who matches (${matched.length})` : "Nobody matches"} clearLabel="Everyone who matches" disabled={!matched.length} invalid={Boolean(errors.audience)} labelledBy={`${id}-people`} />
            </div>
            <label className="portal-check is-wide">
              <input type="checkbox" checked={audience.officials} onChange={(event) => change({ officials: event.target.checked })} />
              <span><strong>Also send to official accounts<InfoTip>The shared mailbox of each unit picked above, such as comelec@ust.edu.ph. They have no position or role, so Who and Role don’t apply to them.</InfoTip></strong></span>
            </label>
          </div>
          {errors.audience && <span className="portal-field-error">{errors.audience}</span>}
        </fieldset>

        <fieldset className="portal-form-section">
          <legend>Message</legend>
          <div className="portal-form-grid">
            <label className={`portal-field is-wide${errors.subject ? " has-error" : ""}`}>
              <span className="portal-field-label">Subject<InfoTip>What recipients see in their inbox before they open the email.</InfoTip></span>
              <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={150} required />
              {errors.subject && <span className="portal-field-error">{errors.subject}</span>}
            </label>
            <label className={`portal-field is-wide${errors.title ? " has-error" : ""}`}>
              <span className="portal-field-label">Title<InfoTip>The heading at the top of the email. Put a word or two between *asterisks* to set them in gold italics, like General *Assembly*. Leave it empty for no heading.</InfoTip></span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Optional" />
              {errors.title && <span className="portal-field-error">{errors.title}</span>}
            </label>
            <div className={`portal-field is-wide${errors.body ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${id}-body`}>Message<InfoTip>Use the Documents editor to format your message, add links and lists, or insert tables. Open Window for more space.</InfoTip></span>
              <DocumentBodyField value={body} onChange={(value) => { setBody(value); setArmed(false); }} label="Message editor" windowTitle="Edit message" invalid={Boolean(errors.body)} />
              {errors.body && <span className="portal-field-error">{errors.body}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className={`portal-form-section${errors.sendAt || errors.delivery ? " has-error" : ""}`}>
          <legend>Delivery</legend>
          <div className="portal-form-grid email-delivery-channels">
            <label className="portal-check">
              <input type="checkbox" checked={sendToEmail} onChange={(event) => { setSendToEmail(event.target.checked); setArmed(false); }} />
              <span><strong>Send to email address</strong></span>
            </label>
            <label className="portal-check">
              <input type="checkbox" checked={sendToInbox} onChange={(event) => { setSendToInbox(event.target.checked); setArmed(false); }} />
              <span><strong>Send to portal inbox</strong></span>
            </label>
          </div>
          {!(sendToEmail || sendToInbox) && <span className="portal-field-error">Choose at least one delivery option.</span>}
          {errors.delivery && <span className="portal-field-error">{errors.delivery}</span>}
          <div className="email-delivery">
            <div className="portal-segmented" role="radiogroup" aria-label="When it goes out">
              <label className={`portal-segment${when === "now" ? " is-selected" : ""}`}>
                <input type="radio" name={`${id}-when`} checked={when === "now"} onChange={() => { setWhen("now"); setArmed(false); }} />
                <Send size={15} strokeWidth={1.9} aria-hidden="true" /> Send now
              </label>
              <label className={`portal-segment${when === "later" ? " is-selected" : ""}`}>
                <input type="radio" name={`${id}-when`} checked={when === "later"} onChange={() => { setWhen("later"); setArmed(false); }} />
                <CalendarClock size={15} strokeWidth={1.9} aria-hidden="true" /> Schedule
              </label>
            </div>
            {when === "later" && (
              <div className="portal-setting-inline">
                <DateTimePicker label="Date and time it goes out, Manila time" value={sendAt} min={sendAtMin} onChange={setSendAt} invalid={Boolean(errors.sendAt)} required />
                <span className="portal-muted">Manila time<InfoTip>It goes to whoever matches the recipients at that time, so people added to the portal before then get it too. You can cancel it from the Outbox until it starts sending.</InfoTip></span>
              </div>
            )}
          </div>
          {errors.sendAt && <span className="portal-field-error">{errors.sendAt}</span>}
        </fieldset>

        <div className="portal-form-footer email-compose-foot">
          {shown?.error ? <p className="portal-form-error" role="alert">{shown.error}</p> : last === "test" && testState?.sent ? <p className="portal-notice" role="status">{testState.sent}</p> : <span />}
          {armed ? (
            <span className="portal-confirm email-confirm">
              <span>Send to {countOf(recipients.length)} now? This can’t be undone.</span>
              <button className="portal-button is-ghost" type="button" disabled={pending} onClick={() => setArmed(false)}>Not yet</button>
              <button className="portal-button" type="submit" disabled={pending}>{sending ? "Sending…" : "Yes, send"}</button>
            </span>
          ) : (
            <div className="portal-form-actions">
              <button className="portal-button is-ghost" type="button" disabled={pending || !hydrated || !ready} onClick={test} title="Sends it only to you using the selected delivery options">
                <FlaskConical size={15} aria-hidden="true" /> {testing ? "Sending test…" : "Send me a test"}
              </button>
              <button className="portal-button" type="submit" disabled={pending || !hydrated || !ready || !recipients.length}>
                {when === "later" ? <CalendarClock size={15} aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
                {sending ? (when === "later" ? "Scheduling…" : "Sending…") : when === "later" ? (scheduledFor ? `Schedule for ${formatClosing(scheduledFor)}` : "Schedule") : `Send to ${countOf(recipients.length)}`}
              </button>
            </div>
          )}
        </div>
      </form>

      <aside className="email-compose-side" aria-label="Preview">
        <p className="portal-index">Preview</p>
        <EmailPreview html={html} from={fromName} to={to} subject={subject} />
      </aside>
    </div>
  );
}

/** " · COS", " · Central": someone's unit, after their role, in the list of people. */
const unitOfPerson = (person: Person) => (person.affiliation === "local" && person.college ? ` · ${unitAbbreviations[person.college] ?? person.college}` : person.affiliation === "central" ? " · Central" : "");

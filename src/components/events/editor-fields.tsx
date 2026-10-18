"use client";
import { answerFormatProblem, answerHint, cleanAnswer, rulesOf, type EditorField, type FormAnswers } from "@/lib/events/form-editor";
import { ratingLabels } from "@/lib/events/evaluation";
import { StudentVerification } from "./student-verification";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightToLine, CheckCircle2 } from "lucide-react";
import { Dropdown } from "@/components/portal/dropdown";
import { Combobox } from "@/components/combobox";
import "./editor-fields.css";

const emailGuide = "With a UST email, you’ll also give your student number.";
const registrationGuide = "After submitting this RSVP, you will receive a public registration link to share with your participants. Each participant must register individually.";
const ustDomain = "@ust.edu.ph";

function placeholderFor(field: EditorField) {
  const rules = rulesOf(field);
  if (rules.studentNumber || field.identity === "studentNumber") return "e.g. 2026123456";
  if (rules.mobile) return "e.g. 09171234567";
  if (field.identity === "lastName" || /\blast name\b/i.test(field.label)) return "e.g. DELA CRUZ";
  if (field.identity === "firstName" || /\bfirst name\b/i.test(field.label)) return "e.g. JUAN";
  if (field.identity === "middleName" || /\bmiddle name\b/i.test(field.label)) return "e.g. SANTOS";
  if (field.kind === "email") return "juan.delacruz@ust.edu.ph";
  if (field.kind === "link") return field.links?.includes("drive") ? "https://drive.google.com/…" : field.links?.includes("facebook") ? "https://www.facebook.com/…" : "https://example.com";
  if (field.kind === "textarea") return "Write your response…";
  if (rules.digits) return "e.g. 10";
  const examples: Record<string, string> = {
    rsvp_additional: "e.g. 10-20",
    rsvp_car_plate: "e.g. ABC 1234",
    rsvp_car_model: "e.g. Toyota Vios",
    rsvp_car_color: "e.g. Silver",
    rsvp_arrival: "e.g. 8:30 AM",
    rsvp_allergens: "e.g. Peanuts, shellfish",
    rsvp_org_name: "Enter your organization’s name",
    rsvp_college: "Enter your college or faculty",
    rsvp_admin_office: "Enter your office’s name",
    rsvp_other_affiliation: "Enter your UST affiliation",
    rsvp_role_other: "Enter how you are attending",
    rsvp_external_org: "Enter your organization or affiliation",
    rsvp_external_school: "Enter your school or university",
    rsvp_resource_other: "Enter the equipment, supplies or materials",
  };
  return examples[field.id] ?? `Enter ${field.label.toLocaleLowerCase("en-PH")}`;
}

function RsvpEmail({ field, value, onChange, error }: { field: EditorField; value: string; onChange: (value: string) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);
  // An address in the wrong format fails the step's check, and its tooltip says why (form-validation.tsx).
  useEffect(() => { input.current?.setCustomValidity(error ?? answerFormatProblem(field, value) ?? ""); }, [field, value, error]);
  const [focused, setFocused] = useState(false);
  const at = value.indexOf("@");
  const local = at < 0 ? value : value.slice(0, at);
  const domain = at < 0 ? "" : value.slice(at);
  const matching = at > 0 && !/\s/.test(local) && ustDomain.startsWith(domain.toLowerCase());
  const highlighted = matching && domain.length >= 2;
  const verified = matching && domain.toLowerCase() === ustDomain;
  const suggestion = focused && matching && !verified ? ustDomain.slice(domain.length) : "";
  const hintId = `${field.id}-domain-hint`;

  function syncScroll() {
    if (mirror.current && input.current) mirror.current.style.transform = `translateX(${-input.current.scrollLeft}px)`;
  }
  useLayoutEffect(syncScroll, [value, focused]);

  return <>
    <label className="apply-field ev-field"><span className="ev-sr-only">{field.label}</span>
      <span className={`ev-ust-email${verified ? " is-verified" : suggestion ? " has-suggestion" : ""}`}>
        <input ref={input} name={field.id} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required={field.required} value={value} placeholder={placeholderFor(field)}
          aria-invalid={!!error} aria-describedby={[suggestion ? hintId : "", error ? `${field.id}-error` : ""].filter(Boolean).join(" ") || undefined}
          onChange={event => onChange(cleanAnswer(field, event.target.value))} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onScroll={syncScroll}
          onKeyDown={event => {
            if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey && suggestion) {
              event.preventDefault();
              onChange(local + ustDomain);
            }
          }} />
        <span className="ev-ust-email-display" aria-hidden="true"><span ref={mirror}>{local}<span className={`ev-ust-email-domain${highlighted ? " is-ust" : ""}`}>{domain}</span><span className="ev-ust-email-suggestion">{suggestion}</span></span></span>
        <span className="ev-ust-email-status" role="status">{verified && <><CheckCircle2 size={14} aria-hidden="true" /><span>Verified <span className="ev-sr-only">UST email domain</span></span></>}</span>
        {suggestion && <span className="ev-ust-email-tab" title={`Press Tab to complete ${ustDomain}`}><kbd><ArrowRightToLine size={14} aria-hidden="true" /></kbd><span className="ev-sr-only" id={hintId}>Press Tab to complete {ustDomain}.</span></span>}
      </span>
    </label>
  </>;
}

/** `locked`: an edit of a sent response, whose verified email stays as it was. */
type Verify = { eventId: string; target: "rsvp-form" | "evaluate"; preview?: boolean; locked?: boolean };

function Required({ field }: { field: EditorField }) { return field.required ? <span className="ev-evaluation-required" aria-label="required">*</span> : null; }
function Hint({ field, hideStudentNumber = false }: { field: EditorField; hideStudentNumber?: boolean }) {
  const prompt = field.prompt.trim() === emailGuide ? "" : field.prompt;
  const rules = answerHint(field).split(" · ").filter(text => text !== "Letters only" && text !== "Letters only, in capitals." && text !== "No special characters" && !(hideStudentNumber && text === "Your 10-digit student number.")).join(" · ");
  const text = [prompt, rules].filter(Boolean).join(" ");
  return text ? <p className="ev-field-hint">{text}</p> : null;
}

/**
 * The questions of an RSVP or Evaluation form, as respondents answer them. Controlled: `values`
 * holds every answer and `onChange` reports each one. Inputs keep their names, so a plain form
 * submission carries them too (ticks in order go as hidden inputs, in the order they were made).
 * With `columns`, short questions in a row share a line, as on the Apply form: two or three across,
 * a lone one full width (the classes size them on a six-column grid; rsvp.css).
 */
export function EditorFields({ fields, visible, values, onChange, verify, columns = false, sectionBreaks, fieldErrors, fieldHints, fieldErrorHelp, portalPickers = false }: { fields: EditorField[]; visible?: ReadonlySet<string>; values: FormAnswers; onChange: (id: string, value: string | string[]) => void; verify?: Verify; columns?: boolean; sectionBreaks?: Readonly<Record<string, string>>; fieldErrors?: Readonly<Record<string, string>>; fieldHints?: Readonly<Record<string, ReactNode>>; fieldErrorHelp?: Readonly<Record<string, React.ReactNode>>; portalPickers?: boolean }) {
  const reducedMotion = useReducedMotion();
  const questions = fields.filter(field => !(field.kind === "content" && field.prompt.trim() === registrationGuide));
  // Use the complete step to size columns; a revealed question must not rearrange earlier inputs.
  const spans = columns ? lineUp(questions) : [];
  return <AnimatePresence initial={false}>{questions.flatMap((field, index) => {
    if (visible && !visible.has(field.id)) return [];
    const section = sectionBreaks?.[field.id];
    const hasEarlierQuestion = questions.slice(0, index).some(question => !visible || visible.has(question.id));
    return [
      ...(section && hasEarlierQuestion ? [<hr key={`section-${field.id}`} className="ev-form-section-divider" aria-label={`${section} section`} />] : []),
      <RevealedQuestion key={field.id} field={field} value={values[field.id]} onChange={value => onChange(field.id, value)} verify={verify} error={fieldErrors?.[field.id]} portalPickers={portalPickers} errorHelp={fieldErrorHelp?.[field.id]} statusHint={fieldHints?.[field.id]} span={columns && field.id === "rsvp_college" ? 6 : spans[index]} reducedMotion={Boolean(reducedMotion)} />,
    ];
  })}</AnimatePresence>;
}

function RevealedQuestion({ reducedMotion, ...props }: Parameters<typeof Question>[0] & { reducedMotion: boolean }) {
  const present = useIsPresent();
  const content = useRef<HTMLFieldSetElement>(null);
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    // Numeric heights avoid the animation library's temporary "auto" measurement and scroll reset.
    const measure = () => setHeight(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <motion.div className={`ev-field-reveal${props.span ? ` is-span-${props.span}` : ""}`}
    initial={{ height: 0, opacity: 0 }} animate={{ height, opacity: 1 }} exit={{ height: 0, opacity: 0 }}
    transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: "hidden" }}>
    <fieldset ref={content} className="ev-field-reveal-content" disabled={!present} role="presentation"><Question {...props} /></fieldset>
  </motion.div>;
}

const isShort = (field: EditorField) => field.kind === "text" || field.kind === "link" || field.kind === "dropdown" || (field.kind === "email" && !field.verifyUst);

/** Each field's share of the line: runs of short questions split into lines of three, or two when that leaves none alone. */
function lineUp(fields: EditorField[]) {
  const spans: Array<2 | 3 | 6> = [];
  for (let start = 0; start < fields.length;) {
    let end = start;
    while (end < fields.length && isShort(fields[end])) end++;
    if (end === start) { spans.push(6); start++; continue; }
    for (let left = end - start; left > 0;) {
      const line = left === 1 ? 1 : left === 2 || left === 4 ? 2 : 3;
      for (let i = 0; i < line; i++) spans.push(line === 1 ? 6 : line === 2 ? 3 : 2);
      left -= line;
    }
    start = end;
  }
  return spans;
}

function Question({ field, value, onChange, verify, span, error, statusHint, errorHelp, portalPickers }: { field: EditorField; value: string | string[] | undefined; onChange: (value: string | string[]) => void; verify?: Verify; span?: 2 | 3 | 6; error?: string; statusHint?: ReactNode; errorHelp?: React.ReactNode; portalPickers?: boolean }) {
  const fieldset = `ev-group ev-custom-field${span ? ` is-span-${span}` : ""}`;
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];

  if (field.kind === "content") return <div className="ev-evaluation-written"><h3>{field.label}</h3>{field.prompt && <p>{field.prompt}</p>}</div>;
  if (field.kind === "image" && field.image) return (
    <figure className={`ev-form-image is-${field.image.size}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Uploaded form images are already shrunk to 1 MB in the browser. */}
      <a href={field.image.url} target="_blank" rel="noopener"><img src={field.image.url} alt={field.label} loading="lazy" /></a>
      {field.prompt && <figcaption>{field.prompt}</figcaption>}
    </figure>
  );
  if (field.kind === "image") return null;
  if (field.kind === "confirm") return (
    <label className="ev-evaluation-check ev-confirm">
      <input type="checkbox" name={field.id} value="yes" checked={text === "yes"} required={field.required} onChange={event => onChange(event.target.checked ? "yes" : "")} />
      <span><strong>{field.label}<Required field={field} /></strong>{field.prompt && <small>{field.prompt}</small>}</span>
    </label>
  );

  const legend = <legend className="apply-field-label ev-field-label" id={`${field.id}-label`}>{field.label}<Required field={field} /></legend>;
  if (field.kind === "checkbox") {
    const max = field.max ?? field.options.length;
    return <fieldset className={fieldset}>{legend}<Hint field={field} />
      <div className="ev-rsvp-committees">{field.options.map((option, index) => {
        const rank = list.indexOf(option) + 1;
        const note = field.notes?.[index];
        return <label className={`ev-evaluation-check ev-rsvp-committee${rank ? " is-selected" : ""}`} key={option}>
          <input type="checkbox" name={field.ranked ? undefined : field.id} value={option} checked={rank > 0} disabled={!rank && list.length >= max} onChange={event => onChange(event.target.checked ? [...list, option] : list.filter(item => item !== option))} />
          <span>{note ? <><strong>{option}</strong><small>{note}</small></> : option}{rank > 0 && field.ranked && <span className="ev-sr-only">Choice {rank}</span>}</span>
          {rank > 0 && field.ranked && <b className="ev-rsvp-rank" aria-hidden="true">{rank}</b>}
        </label>;
      })}</div>
      {field.ranked && list.map(option => <input key={option} type="hidden" name={field.id} value={option} />)}
      {max < field.options.length && <p className="ev-field-hint" role="status">{list.length} of {max} ticked.</p>}
    </fieldset>;
  }
  if (field.kind === "rating") return (
    <fieldset className={fieldset}>{legend}<Hint field={field} />
      <div className="ev-rating-options">{ratingLabels.map((label, index) => {
        const option = String(index + 1);
        return <label key={option}><input type="radio" name={field.id} value={option} checked={text === option} required={field.required} onChange={() => onChange(option)} /><b>{option}</b><span>{label}</span></label>;
      })}</div>
    </fieldset>
  );
  if (field.kind === "radio") {
    const options = field.options;
    return <fieldset className={fieldset}>{legend}<Hint field={field} />
      <div className="ev-event-choices">{options.map((option, index) => {
        const note = field.notes?.[index];
        return <label className="ev-evaluation-check" key={option}><input type="radio" name={field.id} value={option} checked={text === option} required={field.required} onChange={() => onChange(option)} /><span>{note ? <><strong>{option}</strong><small>{note}</small></> : option}</span></label>;
      })}</div>
    </fieldset>;
  }
  if (field.kind === "dropdown" && field.id === "rsvp_college") return (
    <fieldset className={fieldset}>{legend}
      <div className="apply-field ev-field"><Combobox name={field.id} options={field.options} value={text} onChange={onChange} placeholder="Type or pick your college" required={field.required} labelledBy={`${field.id}-label`} /></div>
      <Hint field={field} />
    </fieldset>
  );
  if (field.kind === "dropdown" && portalPickers) return <fieldset className={fieldset}>{legend}<div className="apply-field ev-field"><Dropdown name={field.id} value={text} onChange={onChange} options={field.options.map(value => ({ value, label: value }))} required={field.required} labelledBy={`${field.id}-label`} /></div><Hint field={field} /></fieldset>;
  if (field.kind === "dropdown") return (
    <fieldset className={fieldset}>{legend}
      <label className="apply-field ev-field"><span className="ev-sr-only">{field.label}</span><select name={field.id} required={field.required} value={text} onChange={event => onChange(event.target.value)}><option value="">Select an option</option>{field.options.map(option => <option key={option}>{option}</option>)}</select></label>
      <Hint field={field} />
    </fieldset>
  );
  if (field.kind === "email" && field.verifyUst) return (
    <fieldset className={fieldset}>{legend}
      <label className="apply-field ev-field"><span className="ev-sr-only">{field.label}</span><input name={field.id} type="email" value={text} aria-invalid={!!error} aria-describedby={error ? `${field.id}-error` : undefined} ref={element => element?.setCustomValidity(error ?? "")} readOnly required={field.required} placeholder="Verify to fill this in" /></label>
      <Hint field={field} />
      {error && <p className="ev-field-error" id={`${field.id}-error`} role="alert">{error}{errorHelp && <><br />{errorHelp}</>}</p>}
      {statusHint && <p className="ev-field-hint" role="status">{statusHint}</p>}
      {portalPickers || (verify?.locked && text) ? <p className="ev-field-hint">This verified email can’t be changed here.</p> : verify && !verify.preview ? <StudentVerification eventId={verify.eventId} target={verify.target} onVerified={onChange} /> : <p className="ev-field-hint">Respondents verify with their UST Google account here.</p>}
    </fieldset>
  );

  const rules = rulesOf(field);
  if (field.kind === "email" && verify?.target === "rsvp-form") return (
    <fieldset className={fieldset}>{legend}
      <RsvpEmail field={field} value={text} onChange={onChange} error={error} />
      {error && <p className="ev-field-error" id={`${field.id}-error`} role="alert">{error}{errorHelp && <><br />{errorHelp}</>}</p>}
      {statusHint && <p className="ev-field-hint" role="status">{statusHint}</p>}
      <Hint field={field} />
    </fieldset>
  );
  const numeric = rules.studentNumber || rules.mobile || rules.digits;
  const common = {
    name: field.id,
    required: field.required,
    value: text,
    placeholder: placeholderFor(field),
    inputMode: numeric ? "numeric" as const : field.kind === "email" ? "email" as const : field.kind === "link" ? "url" as const : undefined,
    // Names, numbers and emails keep only what their rules allow, as they're typed (src/lib/forms/input.ts).
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(cleanAnswer(field, event.target.value)),
    // An answer in the wrong format fails the step's check, and its tooltip says why (form-validation.tsx).
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => element?.setCustomValidity(answerFormatProblem(field, text) ?? ""),
  };
  return (
    <fieldset className={fieldset}>{legend}
      <label className="apply-field ev-field"><span className="ev-sr-only">{field.label}</span>
        {field.kind === "textarea" ? <textarea rows={4} maxLength={4000} {...common} /> : <input type={field.kind === "email" ? "email" : field.kind === "link" ? "url" : "text"} maxLength={rules.studentNumber ? 10 : rules.mobile ? 11 : field.kind === "email" ? 254 : 4000} autoCapitalize={rules.uppercase ? "characters" : undefined} {...common} />}
      </label>
      <Hint field={field} hideStudentNumber={verify?.target === "rsvp-form"} />
    </fieldset>
  );
}

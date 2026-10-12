"use client";
import { answerHint, cleanAnswer, rulesOf, type EditorField, type FormAnswers } from "@/lib/events/form-editor";
import { StudentVerification } from "./student-verification";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowRightToLine, CheckCircle2 } from "lucide-react";
import "./editor-fields.css";

const emailGuide = "With a UST email, you’ll also give your student number.";
const registrationGuide = "After submitting this RSVP, you will receive a public registration link to share with your participants. Each participant must register individually.";
const ustDomain = "@ust.edu.ph";

function RsvpEmail({ field, value, onChange }: { field: EditorField; value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const mirror = useRef<HTMLSpanElement>(null);
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
    <label className="ev-field"><span className="ev-sr-only">{field.label}</span>
      <span className={`ev-ust-email${verified ? " is-verified" : suggestion ? " has-suggestion" : ""}`}>
        <input ref={input} name={field.id} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={254} required={field.required} value={value}
          aria-describedby={suggestion ? hintId : undefined}
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

type Verify = { eventId: string; target: "rsvp-form" | "evaluate"; preview?: boolean };

function Required({ field }: { field: EditorField }) { return field.required ? <span className="ev-evaluation-required" aria-label="required">*</span> : null; }
function Hint({ field, hideStudentNumber = false }: { field: EditorField; hideStudentNumber?: boolean }) {
  const prompt = field.prompt.trim() === emailGuide ? "" : field.prompt;
  const rules = answerHint(field).split(" · ").filter(text => text !== "Letters only" && text !== "No special characters" && !(hideStudentNumber && text === "Your 10-digit student number.")).join(" · ");
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
export function EditorFields({ fields, visible, values, onChange, verify, columns = false }: { fields: EditorField[]; visible?: ReadonlySet<string>; values: FormAnswers; onChange: (id: string, value: string | string[]) => void; verify?: Verify; columns?: boolean }) {
  const reducedMotion = useReducedMotion();
  const questions = fields.filter(field => !(field.kind === "content" && field.prompt.trim() === registrationGuide));
  // Use the complete step to size columns; a revealed question must not rearrange earlier inputs.
  const spans = columns ? lineUp(questions) : [];
  return <AnimatePresence initial={false}>{questions.map((field, index) => (!visible || visible.has(field.id)) && <RevealedQuestion key={field.id} field={field} value={values[field.id]} onChange={value => onChange(field.id, value)} verify={verify} span={spans[index]} reducedMotion={Boolean(reducedMotion)} />)}</AnimatePresence>;
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

function Question({ field, value, onChange, verify, span }: { field: EditorField; value: string | string[] | undefined; onChange: (value: string | string[]) => void; verify?: Verify; span?: 2 | 3 | 6 }) {
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

  const legend = <legend className="ev-field-label">{field.label}<Required field={field} /></legend>;
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
  if (field.kind === "radio" || field.kind === "rating") {
    const options = field.kind === "rating" ? ["1", "2", "3", "4", "5"] : field.options;
    return <fieldset className={fieldset}>{legend}<Hint field={field} />
      {options.map((option, index) => {
        const note = field.notes?.[index];
        return <label className="ev-evaluation-check" key={option}><input type="radio" name={field.id} value={option} checked={text === option} required={field.required} onChange={() => onChange(option)} /><span>{note ? <><strong>{option}</strong><small>{note}</small></> : option}</span></label>;
      })}
    </fieldset>;
  }
  if (field.kind === "dropdown") return (
    <fieldset className={fieldset}>{legend}
      <label className="ev-field"><span className="ev-sr-only">{field.label}</span><select name={field.id} required={field.required} value={text} onChange={event => onChange(event.target.value)}><option value="">Select an option</option>{field.options.map(option => <option key={option}>{option}</option>)}</select></label>
      <Hint field={field} />
    </fieldset>
  );
  if (field.kind === "email" && field.verifyUst) return (
    <fieldset className={fieldset}>{legend}
      <label className="ev-field"><span className="ev-sr-only">{field.label}</span><input name={field.id} type="email" value={text} readOnly required={field.required} placeholder="Verify to fill this in" /></label>
      <Hint field={field} />
      {verify && !verify.preview ? <StudentVerification eventId={verify.eventId} target={verify.target} onVerified={onChange} /> : <p className="ev-field-hint">Respondents verify with their UST Google account here.</p>}
    </fieldset>
  );

  const rules = rulesOf(field);
  if (field.kind === "email" && verify?.target === "rsvp-form") return (
    <fieldset className={fieldset}>{legend}
      <RsvpEmail field={field} value={text} onChange={onChange} />
      <Hint field={field} />
    </fieldset>
  );
  const numeric = rules.studentNumber || rules.mobile || rules.digits;
  const common = {
    name: field.id,
    required: field.required,
    value: text,
    inputMode: numeric ? "numeric" as const : field.kind === "email" ? "email" as const : field.kind === "link" ? "url" as const : undefined,
    // Names, numbers and emails keep only what their rules allow, as they're typed (src/lib/forms/input.ts).
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(cleanAnswer(field, event.target.value)),
  };
  return (
    <fieldset className={fieldset}>{legend}
      <label className="ev-field"><span className="ev-sr-only">{field.label}</span>
        {field.kind === "textarea" ? <textarea rows={4} maxLength={4000} {...common} /> : <input type={field.kind === "email" ? "email" : field.kind === "link" ? "url" : "text"} maxLength={rules.studentNumber ? 10 : rules.mobile ? 11 : field.kind === "email" ? 254 : 4000} autoCapitalize={rules.uppercase ? "characters" : undefined} placeholder={field.kind === "link" ? "https://" : undefined} {...common} />}
      </label>
      <Hint field={field} hideStudentNumber={verify?.target === "rsvp-form"} />
    </fieldset>
  );
}

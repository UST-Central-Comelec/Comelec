"use client";
import { answerHint, type EditorField, type FormAnswers } from "@/lib/events/form-editor";
import { StudentVerification } from "./student-verification";

type Verify = { eventId: string; target: "rsvp-form" | "evaluate"; preview?: boolean };

function Required({ field }: { field: EditorField }) { return field.required ? <span className="ev-evaluation-required" aria-label="required">*</span> : null; }
function Hint({ field }: { field: EditorField }) {
  const text = [field.prompt, answerHint(field)].filter(Boolean).join(" ");
  return text ? <p className="ev-field-hint">{text}</p> : null;
}

/**
 * The questions of an RSVP or Evaluation form, as respondents answer them. Controlled: `values`
 * holds every answer and `onChange` reports each one. Inputs keep their names, so a plain form
 * submission carries them too (ticks in order go as hidden inputs, in the order they were made).
 * With `columns`, short questions in a row share a line, as on the Apply form: two or three across,
 * a lone one full width (the classes size them on a six-column grid; rsvp.css).
 */
export function EditorFields({ fields, values, onChange, verify, columns = false }: { fields: EditorField[]; values: FormAnswers; onChange: (id: string, value: string | string[]) => void; verify?: Verify; columns?: boolean }) {
  const spans = columns ? lineUp(fields) : [];
  return <>{fields.map((field, index) => <Question key={field.id} field={field} value={values[field.id]} onChange={value => onChange(field.id, value)} verify={verify} span={spans[index]} />)}</>;
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
      <div className={field.ranked ? "ev-rsvp-committees" : undefined}>{field.options.map((option, index) => {
        const rank = list.indexOf(option) + 1;
        const note = field.notes?.[index];
        return <label className={`ev-evaluation-check${field.ranked ? " ev-rsvp-committee" : ""}${rank ? " is-selected" : ""}`} key={option}>
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

  const rules = field.rules ?? {};
  const numeric = rules.studentNumber || rules.digits;
  const common = {
    name: field.id,
    required: field.required,
    value: text,
    inputMode: numeric ? "numeric" as const : field.kind === "email" ? "email" as const : field.kind === "link" ? "url" as const : undefined,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(rules.uppercase ? event.target.value.toLocaleUpperCase("en-PH") : event.target.value),
  };
  return (
    <fieldset className={fieldset}>{legend}
      <label className="ev-field"><span className="ev-sr-only">{field.label}</span>
        {field.kind === "textarea" ? <textarea rows={4} maxLength={4000} {...common} /> : <input type={field.kind === "email" ? "email" : field.kind === "link" ? "url" : "text"} maxLength={rules.studentNumber ? 10 : field.kind === "email" ? 254 : 4000} autoCapitalize={rules.uppercase ? "characters" : undefined} placeholder={field.kind === "link" ? "https://" : undefined} {...common} />}
      </label>
      <Hint field={field} />
    </fieldset>
  );
}

"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileText, Plus, Trash2 } from "lucide-react";
import { communicationDeclaration, conformeDeclarations, MAX_FILE_BYTES, MAX_TOTAL_BYTES, petitionDeclaration, requirements, rosterSections, templateHref, uploadTypes, type RosterId } from "@/lib/polpar/content";
import { fieldErrors, partyRegistrationSchema, type Conforme, type PartyRegistration, type PartyResponse } from "@/lib/polpar/schema";
import { DatePicker } from "@/components/portal/date-picker";
import { PdfDownloads } from "./pdf-downloads";

const steps = ["Party information", "Petition", "Officers", "Members", "Active alumni", "Local affiliates", "Membership conformes", "Download filled forms", "Signed documents", "Review & submit"];
type UnitChoice = { value: string; label: string; closes: string | null };
type Rows = Record<RosterId, string[]>;

function Field({ name, label, type = "text", required = true, error, children, defaultValue }: { name: string; label: string; type?: string; required?: boolean; error?: string; children?: ReactNode; defaultValue?: string }) {
  return <label className="pp-field" htmlFor={`pp-${name}`}>
    <span>{label}{required && <span aria-hidden="true"> *</span>}</span>
    {children ?? (type === "date" ? <DatePicker id={`pp-${name}`} name={name} defaultValue={defaultValue} required={required} invalid={!!error} describedBy={error ? `pp-error-${name}` : undefined} /> : <input id={`pp-${name}`} name={name} type={type} defaultValue={defaultValue} required={required} maxLength={type === "text" || type === "tel" ? 250 : undefined} aria-invalid={!!error} aria-describedby={error ? `pp-error-${name}` : undefined} />)}
    {error && <small id={`pp-error-${name}`} className="pp-error">{error}</small>}
  </label>;
}

export function PartyRegistrationForm({ units, initialUnit }: { units: UnitChoice[]; initialUnit: string }) {
  const [step, setStep] = useState(0);
  const [unit, setUnit] = useState(initialUnit);
  const [partyName, setPartyName] = useState("");
  const [rows, setRows] = useState<Rows>({ officers: ["first-officer"], members: ["first-member"], alumni: [], affiliates: [] });
  const [conformes, setConformes] = useState<Array<{ id: string; initial: Partial<Conforme> }>>([]);
  const [submittedValues, setSubmittedValues] = useState<PartyRegistration | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PartyResponse>({});
  const [pending, setPending] = useState(false);
  const [uploads, setUploads] = useState<Record<string, File[]>>({});
  const [review, setReview] = useState<PartyRegistration | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const submissionId = useRef<string | null>(null);
  const chosenUnit = units.find((item) => item.value === unit);

  useEffect(() => { heading.current?.focus(); }, [step, result.receipt]);

  function readValues(): PartyRegistration {
    const fd = new FormData(form.current!);
    const text = (key: string) => String(fd.get(key) ?? "").trim();
    const signatory = (prefix: string) => ({ fullName: text(`${prefix}.fullName`), position: text(`${prefix}.position`) });
    const lists = Object.fromEntries(rosterSections.map((section) => [section.id, rows[section.id].map((_, index) => Object.fromEntries(section.fields.map((field) => [field.key, text(`${section.id}.${index}.${field.key}`)])))]));
    return {
      unit, partyName, establishedAt: text("establishedAt"), headquarters: text("headquarters"), contactPerson: text("contactPerson"), contactNumber: text("contactNumber"), email: text("email"), petitionDate: text("petitionDate"),
      petitionSignatory: signatory("petitionSignatory"),
      ...lists,
      certifications: Object.fromEntries(rosterSections.map((section) => [section.id, signatory(`certifications.${section.id}`)])),
      conformes: conformes.map((_, index) => Object.fromEntries(["fullName", "college", "studentNumber", "signedOn", "witness1Name", "witness1Date", "witness2Name", "witness2Date"].map((key) => [key, text(`conformes.${index}.${key}`)]))),
      submittedBy: text("submittedBy"), submittedPosition: text("submittedPosition"),
      petitionAccepted: fd.has("petitionAccepted"), recordsAccepted: fd.has("recordsAccepted"), conformeAccepted: fd.has("conformeAccepted"),
    } as PartyRegistration;
  }

  function validStep() {
    const panel = form.current?.querySelector(`[data-step="${step}"]`);
    const inputs = panel?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input, select");
    for (const input of inputs ?? []) if (!input.reportValidity()) return false;
    if (step === 6 && conformes.length === 0) { setResult({ error: "Add an applicant member to prepare a filled membership conforme." }); return false; }
    if (step === 8) {
      const nextErrors = uploadErrors();
      if (Object.keys(nextErrors).length) { setErrors(nextErrors); setResult({ error: "Check the document uploads below." }); return false; }
    }
    return true;
  }

  function uploadErrors() {
    const next: Record<string, string> = {};
    let total = 0;
    for (const requirement of requirements) {
      const files = uploads[requirement.id] ?? [];
      if (!files.length && !(requirement.id === "alumniIds" && !rows.alumni.length)) next[requirement.id] = "Attach this requirement.";
      for (const file of files) {
        total += file.size;
        if (file.size === 0 || file.size > MAX_FILE_BYTES || !Object.hasOwn(uploadTypes, file.type)) next[requirement.id] = "Use PDF, JPG, or PNG files up to 10 MB each.";
      }
    }
    if (total > MAX_TOTAL_BYTES) next.uploads = "The combined uploads exceed 30 MB.";
    return next;
  }

  function forward() {
    if (!validStep()) return;
    setErrors({}); setResult({});
    if (step === 5 && !conformes.length) importConformes();
    if (step === 8) setReview(readValues());
    setStep((value) => Math.min(value + 1, steps.length - 1));
  }

  function importConformes() {
    const values = readValues();
    const existing = new Set(values.conformes.map((item) => item.studentNumber));
    const additions: Array<{ id: string; initial: Partial<Conforme> }> = [];
    for (const person of [...values.officers, ...values.members]) {
      if (!person.studentNumber || existing.has(person.studentNumber)) continue;
      existing.add(person.studentNumber);
      additions.push({ id: crypto.randomUUID(), initial: { fullName: person.fullName, college: person.college, studentNumber: person.studentNumber } });
    }
    setConformes((current) => [...current, ...additions]);
  }

  function stepOf(field: string) {
    if (field.startsWith("petition")) return 1;
    for (const [index, section] of rosterSections.entries()) if (field.startsWith(`${section.id}.`) || field.startsWith(`certifications.${section.id}.`)) return index + 2;
    if (field.startsWith("conformes")) return 6;
    if (field === "conformeAccepted" || field === "uploads" || requirements.some((item) => item.id === field)) return 8;
    if (field.startsWith("submitted")) return 7;
    if (field === "recordsAccepted") return 9;
    return 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (step < 9) { forward(); return; }
    if (!validStep()) return;
    const parsed = partyRegistrationSchema.safeParse(readValues());
    const nextErrors = { ...(parsed.success ? {} : fieldErrors(parsed.error)), ...uploadErrors() };
    if (!parsed.success || Object.keys(nextErrors).length) {
      setErrors(nextErrors); setResult({ error: "Check the highlighted fields before submitting." }); setStep(stepOf(Object.keys(nextErrors)[0])); return;
    }
    setPending(true); setErrors({}); setResult({});
    const packet = new FormData();
    submissionId.current ??= crypto.randomUUID();
    packet.set("submissionId", submissionId.current);
    packet.set("payload", JSON.stringify(parsed.data));
    for (const requirement of requirements) for (const file of uploads[requirement.id] ?? []) packet.append(requirement.id, file);
    try {
      const response = await fetch("/api/polpar", { method: "POST", body: packet });
      const state: PartyResponse = await response.json();
      if (state.receipt) setSubmittedValues(parsed.data);
      setResult(state);
      if (state.fieldErrors) { setErrors(state.fieldErrors); setStep(stepOf(Object.keys(state.fieldErrors)[0])); }
      if (!response.ok && !state.error) setResult({ error: "Your registration could not be saved. Please try again." });
    } catch { setResult({ error: "We couldn’t confirm your submission. Check your connection and try again; a retry will keep the same receipt if it was already saved." }); }
    finally { setPending(false); }
  }

  function renderSignatory(prefix: string) {
    return <div className="pp-grid"><Field name={`${prefix}.fullName`} label="Certifying representative’s full name" error={errors[`${prefix}.fullName`]} /><Field name={`${prefix}.position`} label="Position in the party" error={errors[`${prefix}.position`]} /></div>;
  }

  if (result.receipt) return <section className="pp-receipt" aria-live="polite">
    <CheckCircle2 size={44} aria-hidden="true" /><p className="bp-eyebrow">Application received</p>
    <h2 ref={heading} tabIndex={-1}>Your party’s application is submitted.</h2>
    <p><strong>{result.receipt.partyName}</strong> has been submitted for the Commission’s review. Submission does not yet mean recognition.</p>
    <div className="pp-reference"><span>Keep your reference number</span><strong>{result.receipt.reference}</strong></div>
    <p>Received {new Date(result.receipt.submittedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "long", timeStyle: "short" })} (Philippine time).</p>
    <p>For follow-ups, email <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a> and include your reference number.</p>
    <button className="bp-button is-primary" type="button" onClick={() => window.print()}>Print receipt</button>
    {submittedValues && <div className="pp-receipt-downloads"><h3>Download your completed forms</h3><p className="pp-note">These PDFs contain the information you submitted. Signature lines remain blank; your uploaded signed copies are kept separately.</p><PdfDownloads getData={() => submittedValues} /></div>}
  </section>;

  return <div className="pp-layout">
    <aside className="pp-sidebar">
      <p className="bp-eyebrow">Registration checklist</p>
      <ol className="pp-steps">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={step === index ? "is-current" : step > index ? "is-done" : ""}>
        <span>{step > index ? <Check size={14} aria-hidden="true" /> : String(index + 1).padStart(2, "0")}</span><button type="button" disabled={index > step || pending} onClick={() => { setStep(index); setResult({}); }}>{label}</button>
      </li>)}</ol>
      <div className="pp-sidebar-note"><FileText size={19} aria-hidden="true" /><p>Fill in your details here, download the completed PDFs, then sign and upload your copies. Your roster entries carry into the forms automatically.</p><a href={templateHref("Form 07 - Requirement Checklist.docx")} download>View the original checklist <Download size={14} aria-hidden="true" /></a></div>
    </aside>

    <form ref={form} onSubmit={submit} noValidate method="post" className="pp-form">
      <header className="pp-form-head"><span>Step {step + 1} of {steps.length}</span><h2 ref={heading} tabIndex={-1}>{steps[step]}</h2><p>Fields marked * are required. Your entries stay here as you move between steps.</p></header>
      {result.error && <p className="pp-alert" role="alert">{result.error}</p>}
      <fieldset disabled={pending} className="pp-fields">
        <section data-step="0" hidden={step !== 0}>
          <div className="pp-grid">
            <Field name="unit" label="Register with" error={errors.unit}><select id="pp-unit" name="unit" value={unit} onChange={(event) => setUnit(event.target.value)} required>{units.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
            <Field name="partyName" label="Political party name" error={errors.partyName}><input id="pp-partyName" name="partyName" value={partyName} onChange={(event) => setPartyName(event.target.value)} required maxLength={250} /></Field>
            <Field name="establishedAt" label="Date of establishment" type="date" error={errors.establishedAt} />
            <Field name="headquarters" label="Principal headquarters" required={unit === "central"} error={errors.headquarters} />
            <Field name="contactPerson" label="Contact person’s full name" error={errors.contactPerson} />
            <Field name="contactNumber" label="Contact number" type="tel" error={errors.contactNumber} />
            <Field name="email" label="Contact email address" type="email" error={errors.email} />
          </div>
          <p className="pp-note">{chosenUnit?.closes ? `This unit accepts registrations until ${chosenUnit.closes} (Philippine time).` : "This unit is accepting registrations. No closing date has been set."}</p>
        </section>

        <section data-step="1" hidden={step !== 1}>
          <p className="pp-source">COMELEC Form POLPAR-01</p>
          <div className="pp-declaration"><p><strong>{partyName || "Your political party"}</strong>, organized on the establishment date and located at the headquarters entered in Party information, hereby seeks recognition before the UST Central Commission on Elections.</p><p>{petitionDeclaration}</p><p>The undersigned attests to the truthfulness of these statements and declares under oath that they are authorized by the above-named political party to file this petition and thereby bind the party for this purpose.</p></div>
          {renderSignatory("petitionSignatory")}
          <div className="pp-grid"><Field name="petitionDate" label="Date of petition" type="date" error={errors.petitionDate} /></div>
          <label className="pp-check"><input type="checkbox" name="petitionAccepted" required /><span>I confirm the petition declaration and the representative’s authority to file it. The signed petition will be included with our documents.</span></label>
          {errors.petitionAccepted && <p className="pp-error">{errors.petitionAccepted}</p>}
        </section>

        {rosterSections.map((section, sectionIndex) => <section key={section.id} data-step={sectionIndex + 2} hidden={step !== sectionIndex + 2}>
          <div className="pp-roster-head"><p className="pp-source">{section.source} · {rows[section.id].length} listed</p><a href={templateHref(requirements.filter((item) => "template" in item).find((item) => item.id === section.id)!.template)} download>Download form <Download size={14} aria-hidden="true" /></a></div>
          <p className="pp-note">Add an entry for each {section.singular}. The total updates automatically.</p>
          {rows[section.id].map((id, index) => <fieldset className="pp-person" key={id}><legend>{section.singular} {index + 1}</legend>
            <button className="pp-remove" type="button" aria-label={`Remove ${section.singular} ${index + 1}`} onClick={() => setRows((value) => ({ ...value, [section.id]: value[section.id].filter((row) => row !== id) }))}><Trash2 size={15} aria-hidden="true" /> Remove</button>
            <div className="pp-grid">{section.fields.map((field) => { const name = `${section.id}.${index}.${field.key}`; return <Field key={field.key} name={name} label={field.label} type={"type" in field ? field.type : "text"} error={errors[name]} />; })}</div>
          </fieldset>)}
          {!rows[section.id].length && <p className="pp-empty">No {section.title.toLowerCase()} listed. Your submitted {section.source} should reflect this.</p>}
          <button className="bp-button is-ghost is-small" type="button" onClick={() => setRows((value) => ({ ...value, [section.id]: [...value[section.id], crypto.randomUUID()] }))}><Plus size={16} aria-hidden="true" />Add {section.singular}</button>
          <div className="pp-declaration">
            <p>{section.id === "members" ? `This is to certify that the ${rows.members.length} aforementioned members of ${partyName || "the political party"} are bona fide students of the University of Santo Tomas.` : section.id === "alumni" ? `This is to certify that the ${rows.alumni.length} aforementioned alumni of ${partyName || "the political party"} are graduates of the University of Santo Tomas.` : communicationDeclaration}</p>
          </div>
          {renderSignatory(`certifications.${section.id}`)}
          <p className="pp-note">Political party: {partyName || "As entered in Party information"}</p>
        </section>)}

        <section data-step="6" hidden={step !== 6}>
          <p className="pp-source">Form 06 · Membership conforme</p>
          <p className="pp-note">Your officers and members are added once per student number. Confirm each applicant’s name, academic unit and student number, then enter the signing date and both witnesses’ names and dates. The PDF includes a separate conforme for each applicant, with blank signature lines.</p>
          <button type="button" className="bp-button is-ghost is-small" onClick={importConformes}>Add missing officers and members</button>
          {conformes.map((entry, index) => <fieldset className="pp-person" key={entry.id}><legend>Applicant member {index + 1}</legend><button type="button" className="pp-remove" aria-label={`Remove conforme ${index + 1}`} onClick={() => setConformes((current) => current.filter((item) => item.id !== entry.id))}><Trash2 size={15} aria-hidden="true" />Remove</button><div className="pp-grid">
            {([
              ["fullName", "Full name · first name, middle initial, surname", "text"], ["college", "Academic unit", "text"], ["studentNumber", "Student number", "text"], ["signedOn", "Applicant’s signing date", "date"],
              ["witness1Name", "First witness’s full name", "text"], ["witness1Date", "First witness’s signing date", "date"], ["witness2Name", "Second witness’s full name", "text"], ["witness2Date", "Second witness’s signing date", "date"],
            ] as const).map(([key, label, type]) => <Field key={key} name={`conformes.${index}.${key}`} label={label} type={type} defaultValue={entry.initial[key] ?? ""} error={errors[`conformes.${index}.${key}`]} />)}
          </div></fieldset>)}
          <button type="button" className="bp-button is-ghost is-small" onClick={() => setConformes((current) => [...current, { id: crypto.randomUUID(), initial: {} }])}><Plus size={16} aria-hidden="true" />Add applicant member</button>
          <div className="pp-declaration"><p>Each signed conforme must identify the applicant member by first name, middle initial and surname, academic unit, student number, and political party, and contain these declarations:</p><ol>{conformeDeclarations.map((declaration) => <li key={declaration}>{declaration}</li>)}</ol><p>Include the member’s signature over printed name and date, and the signatures over printed names and dates of <strong>two witnesses</strong>.</p></div>
        </section>

        <section data-step="7" hidden={step !== 7}>
          <p className="pp-note">Your entries fill the petition, rosters, individual membership conformes and requirement checklist. Enter the filing representative below, then download all seven forms as one PDF or choose an individual form.</p>
          <h3 className="pp-subheading">Submitted by · Form 07</h3>
          <div className="pp-grid"><Field name="submittedBy" label="Full name" error={errors.submittedBy} /><Field name="submittedPosition" label="Position" error={errors.submittedPosition}><select id="pp-submittedPosition" name="submittedPosition" required defaultValue=""><option value="" disabled>Select position</option><option>Secretary General</option><option>President</option></select></Field></div>
          <PdfDownloads getData={readValues} onValidation={(nextErrors) => { setErrors(nextErrors); setResult({}); const first = Object.keys(nextErrors)[0]; if (!first) return; const target = stepOf(first); if (target !== 7) { setStep(target); setResult({ error: "Complete the highlighted fields, then return to Download filled forms." }); } }} />
          <div className="pp-declaration"><p>Review the downloaded forms, print and sign them, then scan or photograph the signed copies for the next step. Commission receipt, certification and checklist marks remain for Commission personnel to complete.</p><p>If you edit an entry, download a new PDF so your signed forms match the information you submit.</p></div>
        </section>

        <section data-step="8" hidden={step !== 8}>
          <label className="pp-check"><input type="checkbox" name="conformeAccepted" required /><span>I confirm that the uploaded conformes contain the membership declarations and the member’s and two witnesses’ signatures, printed names, and dates.</span></label>
          {errors.conformeAccepted && <p className="pp-error">{errors.conformeAccepted}</p>}
          <h3 className="pp-subheading">Documentary requirements</h3>
          <p className="pp-note">Upload your signed, filled forms and supporting documents as PDF, JPG, or PNG files. Up to 10 MB per file and 30 MB combined. You may select multiple files for each requirement. To generate another copy, return to Download filled forms.</p>
          {errors.uploads && <p className="pp-alert" role="alert">{errors.uploads}</p>}
          <div className="pp-uploads">{requirements.map((requirement, index) => {
            const optional = requirement.id === "alumniIds" && !rows.alumni.length;
            const files = uploads[requirement.id] ?? [];
            return <div className="pp-upload" key={requirement.id}>
              <div className="pp-upload-title"><span>{String(index + 1).padStart(2, "0")}</span><label htmlFor={`pp-file-${requirement.id}`}>{requirement.label}{!optional && " *"}</label>{files.length > 0 && <CheckCircle2 size={18} aria-label="Files selected" />}</div>
              <p>{optional ? "No active alumni are listed, so no alumni IDs are requested." : requirement.hint}</p>
              {"template" in requirement && <a href={templateHref(requirement.template)} download>Download template <Download size={13} aria-hidden="true" /></a>}
              <input id={`pp-file-${requirement.id}`} type="file" accept=".pdf,.jpg,.jpeg,.png" multiple aria-invalid={!!errors[requirement.id]} aria-describedby={`pp-upload-info-${requirement.id}`} onChange={(event) => { setUploads((value) => ({ ...value, [requirement.id]: Array.from(event.target.files ?? []) })); }} />
              <div id={`pp-upload-info-${requirement.id}`}>{files.length > 0 && <ul className="pp-file-list">{files.map((file, i) => <li key={i}>{file.name} <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></li>)}</ul>}{errors[requirement.id] && <p className="pp-error">{errors[requirement.id]}</p>}</div>
            </div>;
          })}</div>
        </section>

        <section data-step="9" hidden={step !== 9}>
          {review && <><div className="pp-review"><h3>{review.partyName}</h3><dl><div><dt>Commission unit</dt><dd>{chosenUnit?.label}</dd></div><div><dt>Established</dt><dd>{review.establishedAt}</dd></div>{review.headquarters && <div><dt>Headquarters</dt><dd>{review.headquarters}</dd></div>}<div><dt>Contact person</dt><dd>{review.contactPerson}</dd></div><div><dt>Contact details</dt><dd>{review.email}<br />{review.contactNumber}</dd></div><div><dt>Petition representative</dt><dd>{review.petitionSignatory.fullName} · {review.petitionSignatory.position}</dd></div><div><dt>Petition date</dt><dd>{review.petitionDate}</dd></div></dl></div>
            {rosterSections.map((section) => <details className="pp-review-details" key={section.id}><summary>{section.title} <span>{rows[section.id].length} listed</span></summary>{review[section.id].map((row, index) => <dl key={index}>{section.fields.map((field) => <div key={field.key}><dt>{field.label}</dt><dd>{(row as Record<string, string>)[field.key]}</dd></div>)}</dl>)}<p>Certified by {review.certifications[section.id].fullName}, {review.certifications[section.id].position}</p><button type="button" className="pp-text-button" onClick={() => setStep(rosterSections.indexOf(section) + 2)}>Edit this section</button></details>)}
          </>}
          <details className="pp-review-details"><summary>Attached documents <span>{Object.values(uploads).reduce((sum, files) => sum + files.length, 0)} files</span></summary>{requirements.map((requirement) => <p key={requirement.id}><strong>{requirement.label}</strong><br />{uploads[requirement.id]?.map((file) => file.name).join(", ") || "No alumni IDs — no active alumni listed"}</p>)}</details>
          <details className="pp-review-details"><summary>Membership conformes <span>{review?.conformes.length ?? 0} applicants</span></summary>{review?.conformes.map((member, index) => <p key={index}><strong>{member.fullName}</strong> · {member.studentNumber}<br />{member.college} · {member.signedOn}<br />Witnesses: {member.witness1Name} ({member.witness1Date}), {member.witness2Name} ({member.witness2Date})</p>)}</details>
          <p className="pp-note">Submitted by {review?.submittedBy} · {review?.submittedPosition} · {partyName}</p>
          <label className="pp-check"><input type="checkbox" name="recordsAccepted" required /><span>I confirm the roster certifications, that the entered information is true and correct, and that the uploaded documents correspond to this application. The party will inform the Commission of changes to its contact information.</span></label>
          {errors.recordsAccepted && <p className="pp-error">{errors.recordsAccepted}</p>}
          <p className="pp-note">Your application and documents will be accessible to authorized Commission personnel for registration review. Keep the reference number shown after submission.</p>
        </section>
      </fieldset>
      <footer className="pp-actions"><button type="button" className="bp-button is-ghost" disabled={step === 0 || pending} onClick={() => { setStep(step - 1); setResult({}); }}><ArrowLeft size={16} aria-hidden="true" />Back</button><button type="submit" className="bp-button is-primary" disabled={pending}>{pending ? "Submitting application…" : step === 9 ? "Submit registration application" : "Continue"}{!pending && <ArrowRight size={16} aria-hidden="true" />}</button></footer>
      <p className="pp-note pp-session-note">Keep this tab open while completing the form. Reloading the page clears unsent entries and selected files.</p>
    </form>
  </div>;
}

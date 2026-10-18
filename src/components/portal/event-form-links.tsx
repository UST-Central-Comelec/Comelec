"use client";
import { DownloadIcon } from "@/components/lucide-animated/download";
import { useEffect, useId, useRef, useState } from "react";
import { FileText, Link2, QrCode, RefreshCw } from "lucide-react";
import { CloseIcon, CopyIcon as Copy } from "@/components/action-icons";
import { getFormQr, regenerateFormQr } from "@/lib/portal/qr-actions";
import { usePortalTheme } from "./portal-theme";
import { toast } from "./toast";
import "./event-form-editor.css";
import { Busy } from "@/components/busy";

type Form = "registration" | "rsvp" | "evaluation";
type Ink = "black" | "white";
type Paper = "transparent" | "mono";
const colors = { black: "#000000", white: "#ffffff" } as const;
const formNames: Record<Form, string> = { registration: "Public registration form", rsvp: "RSVP form", evaluation: "Evaluation form" };
const opposite = (color: Ink): Ink => color === "black" ? "white" : "black";

/** The form’s link card, with direct copying and a QR code dialog. */
export function EventFormLinks({ eventId, eventName, baseUrl, form, qrDisabled = false }: { eventId: string; eventName: string; baseUrl: string; form: Form; qrDisabled?: boolean }) {
  const href = `${baseUrl}${form === "registration" ? `/events/${eventId}/register` : form === "rsvp" ? `/events/${eventId}/rsvp-form` : `/events/${eventId}/evaluate`}`;
  const qrDialog = useRef<HTMLDialogElement>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  useEffect(() => () => {
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => {
        setCopied(false);
        copiedTimer.current = null;
      }, 4000);
      toast("Link copied.");
    }
    catch { toast("Couldn’t copy the link. Try again.", "error"); }
  }

  function openQr() {
    if (qrDisabled) return;
    setQrOpen(true);
    qrDialog.current?.showModal();
  }

  return (
    <div className="portal-event-form-link">
      <span className="portal-event-form-link-icon"><Link2 size={18} aria-hidden="true" /></span>
      <div className="portal-event-form-link-content">
        <span>{form === "registration" ? "Registration form" : formNames[form]} link</span>
        <a href={href} target="_blank" rel="noopener noreferrer">{href}</a>
      </div>
      <div className="portal-form-links">
        <button type="button" className="portal-button is-small is-ghost" onClick={copy}><Copy size={15} aria-hidden="true" /><span aria-live="polite">{copied ? "Link copied" : "Copy Link"}</span></button>
        <button type="button" className="portal-button is-small is-ghost" aria-haspopup="dialog" aria-controls={`${id}-qr`} disabled={qrDisabled} onClick={openQr}><QrCode size={15} aria-hidden="true" />QR Code</button>
      </div>
      <dialog ref={qrDialog} id={`${id}-qr`} className="portal-registrant-confirmation portal-form-link-dialog" aria-labelledby={`${id}-qr-title`} onClose={() => setQrOpen(false)} onClick={event => { if (event.target === event.currentTarget) qrDialog.current?.close(); }}>
        <header className="portal-form-link-dialog-head">
          <h2 id={`${id}-qr-title`}>QR code</h2>
          <button type="button" className="portal-icon-button" aria-label="Close QR code" autoFocus onClick={() => qrDialog.current?.close()}><CloseIcon size={16} aria-hidden="true" /></button>
        </header>
        {qrOpen && <QrPanel key={form} eventId={eventId} eventName={eventName} form={form} />}
      </dialog>
    </div>
  );
}

function QrPanel({ eventId, eventName, form }: { eventId: string; eventName: string; form: Form }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [svg, setSvg] = useState("");
  const theme = usePortalTheme();
  const [preset, setPreset] = useState<{ ink: Ink; paper: Paper }>(() => ({ ink: theme === "light" ? "black" : "white", paper: "mono" }));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"" | "png" | "pdf" | "new">("");
  const file = `${eventId}-${form}-qr`;

  useEffect(() => {
    let live = true;
    getFormQr(eventId, form).then(result => { if (!live) return; if (result.url) setUrl(result.url); else setError(result.error ?? "Couldn’t load the QR code."); }, () => live && setError("Couldn’t load the QR code."));
    return () => { live = false; };
  }, [eventId, form]);

  useEffect(() => {
    if (!url) return;
    let live = true;
    import("qrcode").then(({ default: QRCode }) => QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: colors[preset.ink], light: preset.paper === "transparent" ? "#0000" : colors[opposite(preset.ink)] } })).then(markup => live && setSvg(markup), () => live && setError("Couldn’t draw the QR code."));
    return () => { live = false; };
  }, [url, preset]);

  function choose(next: Partial<typeof preset>) {
    setPreset(current => ({ ...current, ...next }));
  }
  function save(blob: Blob, name: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  async function downloadPng() {
    if (!url) return;
    setBusy("png");
    try {
      const { default: QRCode } = await import("qrcode");
      const data = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M", color: { dark: colors[preset.ink], light: preset.paper === "transparent" ? "#0000" : colors[opposite(preset.ink)] } });
      save(await (await fetch(data)).blob(), `${file}.png`);
    } finally { setBusy(""); }
  }
  /** Black on white, on a Letter page (8.5 × 11 in), as large as the page's margins allow. */
  async function downloadPdf() {
    if (!url) return;
    setBusy("pdf");
    try {
      const [{ default: QRCode }, { PDFDocument, StandardFonts, rgb }] = await Promise.all([import("qrcode"), import("pdf-lib")]);
      const code = QRCode.create(url, { errorCorrectionLevel: "M" });
      const pdf = await PDFDocument.create();
      pdf.setTitle(`${formNames[form]} QR code`);
      const page = pdf.addPage([612, 792]);
      const margin = 36, quiet = 4;
      const size = code.modules.size;
      const cell = (612 - margin * 2) / (size + quiet * 2);
      const left = margin + quiet * cell, top = 792 - margin - quiet * cell;
      // Runs of dark modules in each row are drawn as one rectangle, so the page stays light.
      for (let row = 0; row < size; row++) {
        for (let column = 0; column < size; column++) {
          if (!code.modules.get(row, column)) continue;
          let end = column;
          while (end + 1 < size && code.modules.get(row, end + 1)) end++;
          page.drawRectangle({ x: left + column * cell, y: top - (row + 1) * cell, width: (end - column + 1) * cell + 0.5, height: cell + 0.5, color: rgb(0, 0, 0) });
          column = end;
        }
      }
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const plain = (text: string) => text.normalize("NFKD").replace(/[‘’]/g, "'").replace(/[“”]/g, "\"").replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "");
      // The code fills the page's width at the top; the event, the form and the address go under it.
      const below = 792 - margin - (612 - margin * 2) - 28;
      page.drawText(plain(eventName).slice(0, 80), { x: margin, y: below, size: 18, font: bold, color: rgb(0, 0, 0) });
      page.drawText(plain(formNames[form]), { x: margin, y: below - 24, size: 13, font, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(plain(url), { x: margin, y: below - 44, size: 11, font, color: rgb(0.35, 0.35, 0.35) });
      save(new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }), `${file}.pdf`);
    } finally { setBusy(""); }
  }
  async function generate() {
    setBusy("new");
    const result = await regenerateFormQr(eventId, form).catch(() => ({ error: "Couldn’t make a new QR code." }) as { url?: string; error?: string });
    setBusy("");
    setConfirming(false);
    if (result.url) { setUrl(result.url); setError(""); toast("New QR code made."); } else toast(result.error ?? "Couldn’t make a new QR code.", "error");
  }

  return (
    <div className="portal-qr-panel">
      <p className="portal-qr-title"><strong>QR code</strong><span>{formNames[form]}</span></p>
      <div className={`portal-qr-preview is-${preset.paper === "mono" ? opposite(preset.ink) : "transparent"} is-ink-${preset.ink}`} aria-label={url ? `QR code for ${url}` : "Loading the QR code"} role="img">
        {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="portal-qr-loading">{error ? "" : <Busy>Loading</Busy>}</span>}
      </div>
      {error && <p className="portal-form-error" role="alert">{error}</p>}
      <div className="portal-qr-presets">
        <Segment label="Code" value={preset.ink} options={[["black", "Black"], ["white", "White"]]} onChange={ink => choose({ ink })} />
        <Segment label="Background" value={preset.paper} options={[["transparent", "Transparent"], ["mono", "Mono"]]} onChange={paper => choose({ paper })} />
      </div>
      {confirming ? (
        <div className="portal-qr-confirm" role="group" aria-label="Confirm a new QR code">
          <p>The current code stops working, including on anything already printed. Make a new one?</p>
          <div><button type="button" className="portal-button is-small" disabled={busy === "new"} onClick={generate}>{busy === "new" ? <Busy>Making</Busy> : "Generate new"}</button><button type="button" className="portal-button is-small is-ghost" onClick={() => setConfirming(false)}>Keep this one</button></div>
        </div>
      ) : (
        <div className="portal-qr-actions">
          <button type="button" className="portal-button is-small" disabled={!svg || busy !== ""} onClick={downloadPng}><DownloadIcon size={14} aria-hidden="true" />{busy === "png" ? <Busy>Saving</Busy> : "PNG"}</button>
          <button type="button" className="portal-button is-small is-ghost" disabled={!url || busy !== ""} onClick={downloadPdf} title="Black code on a Letter page"><FileText size={14} aria-hidden="true" />{busy === "pdf" ? <Busy>Saving</Busy> : "PDF"}</button>
          <button type="button" className="portal-button is-small is-ghost" disabled={!url || busy !== ""} onClick={() => setConfirming(true)}><RefreshCw size={14} aria-hidden="true" />Generate new</button>
        </div>
      )}
      {url && <p className="portal-qr-url">Opens <span>{url.replace(/^https?:\/\//, "")}</span></p>}
    </div>
  );
}

function Segment<Value extends string>({ label, value, options, onChange }: { label: string; value: Value; options: Array<[Value, string]>; onChange: (value: Value) => void }) {
  return <div className="portal-qr-segment" role="radiogroup" aria-label={label}>
    <span>{label}</span>
    <div>{options.map(([option, text]) => <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)}>{text}</button>)}</div>
  </div>;
}

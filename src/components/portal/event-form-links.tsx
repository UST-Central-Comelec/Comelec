"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, FileText, QrCode, RefreshCw } from "lucide-react";
import { getFormQr, regenerateFormQr } from "@/lib/portal/qr-actions";
import { usePortalTheme } from "./portal-theme";
import { toast } from "./toast";

type Form = "registration" | "rsvp" | "evaluation";
type Ink = "black" | "white";
type Paper = "transparent" | "white" | "black";
const colors = { black: "#000000", white: "#ffffff" } as const;
const formNames: Record<Form, string> = { registration: "Public registration form", rsvp: "RSVP form", evaluation: "Evaluation form" };
const opposite = (color: Ink): Ink => color === "black" ? "white" : "black";

/**
 * Beside the event editor's tabs: the link to the tab's form, a Copy button, and its QR code. The QR
 * panel opens under its button with the code, colour presets (starting from the portal's theme: black on
 * white in light mode, white on black in dark; every option can always be picked, and picking a colour
 * the other side already uses flips that side), downloads (PNG in the preset, PDF in
 * black on a Letter page at the largest size that fits) and Generate new, which retires the old code.
 */
export function EventFormLinks({ eventId, eventName, baseUrl, form }: { eventId: string; eventName: string; baseUrl: string; form: Form }) {
  const href = `${baseUrl}${form === "registration" ? `/events/${eventId}/register` : form === "rsvp" ? `/events/${eventId}/rsvp-form` : `/events/${eventId}/evaluate`}`;
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  async function copy() {
    try { await navigator.clipboard.writeText(href); setCopied(true); setTimeout(() => setCopied(false), 2000); toast("Link copied."); }
    catch { toast("Couldn’t copy. Select the link and copy it manually.", "error"); }
  }

  return (
    <div className="portal-form-links" ref={wrap}>
      <span className="portal-form-links-label">Link:</span>
      <a className="portal-form-links-url" href={href} target="_blank" rel="noopener" title={href}>{href.replace(/^https?:\/\//, "")}</a>
      <button type="button" className="portal-button is-small is-ghost" onClick={copy} aria-live="polite">{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? "Copied" : "Copy"}</button>
      <button type="button" className="portal-button is-small is-ghost" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><QrCode size={14} aria-hidden="true" />QR Code</button>
      {open && <QrPanel key={form} eventId={eventId} eventName={eventName} form={form} />}
    </div>
  );
}

function QrPanel({ eventId, eventName, form }: { eventId: string; eventName: string; form: Form }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [svg, setSvg] = useState("");
  const theme = usePortalTheme();
  const [preset, setPreset] = useState<{ ink: Ink; paper: Paper }>(() => theme === "light" ? { ink: "black", paper: "white" } : { ink: "white", paper: "black" });
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
    import("qrcode").then(({ default: QRCode }) => QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: { dark: colors[preset.ink], light: preset.paper === "transparent" ? "#0000" : colors[preset.paper] } })).then(markup => live && setSvg(markup), () => live && setError("Couldn’t draw the QR code."));
    return () => { live = false; };
  }, [url, preset]);

  function choose(next: Partial<typeof preset>) {
    const value = { ...preset, ...next };
    // A code the colour of its background can't be scanned, so the side not just picked flips.
    if (value.ink === value.paper) {
      if (next.ink) value.paper = opposite(value.ink);
      else value.ink = opposite(value.ink);
    }
    setPreset(value);
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
      const data = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: "M", color: { dark: colors[preset.ink], light: preset.paper === "transparent" ? "#0000" : colors[preset.paper] } });
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
    <div className="portal-qr-panel" role="dialog" aria-label={`${formNames[form]} QR code`}>
      <p className="portal-qr-title"><strong>QR code</strong><span>{formNames[form]}</span></p>
      <div className={`portal-qr-preview is-${preset.paper} is-ink-${preset.ink}`} aria-label={url ? `QR code for ${url}` : "Loading the QR code"} role="img">
        {svg ? <span dangerouslySetInnerHTML={{ __html: svg }} /> : <span className="portal-qr-loading">{error ? "" : "Loading…"}</span>}
      </div>
      {error && <p className="portal-form-error" role="alert">{error}</p>}
      <div className="portal-qr-presets">
        <Segment label="Code" value={preset.ink} options={[["black", "Black"], ["white", "White"]]} onChange={ink => choose({ ink })} />
        <Segment label="Background" value={preset.paper} options={[["transparent", "Transparent"], ["white", "White"], ["black", "Black"]]} onChange={paper => choose({ paper })} />
      </div>
      {confirming ? (
        <div className="portal-qr-confirm" role="group" aria-label="Confirm a new QR code">
          <p>The current code stops working, including on anything already printed. Make a new one?</p>
          <div><button type="button" className="portal-button is-small" disabled={busy === "new"} onClick={generate}>{busy === "new" ? "Making…" : "Generate new"}</button><button type="button" className="portal-button is-small is-ghost" onClick={() => setConfirming(false)}>Keep this one</button></div>
        </div>
      ) : (
        <div className="portal-qr-actions">
          <button type="button" className="portal-button is-small" disabled={!svg || busy !== ""} onClick={downloadPng}><Download size={14} aria-hidden="true" />{busy === "png" ? "Saving…" : "PNG"}</button>
          <button type="button" className="portal-button is-small is-ghost" disabled={!url || busy !== ""} onClick={downloadPdf} title="Black code on a Letter page"><FileText size={14} aria-hidden="true" />{busy === "pdf" ? "Saving…" : "PDF"}</button>
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

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Download, FileText } from "lucide-react";
import { CopyIcon as Copy, CloseIcon as X } from "@/components/action-icons";
import QRCode from "qrcode";
import { toast } from "@/components/portal/toast";

// Export colours stay independent of the page’s theme.
const colors = { black: "#000000", white: "#ffffff", transparent: "#00000000" } as const;

export function RegistrationShare({ link }: { link: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [ink, setInk] = useState<"black" | "white">("black");
  const [paper, setPaper] = useState<"black" | "white" | "transparent">("white");
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState<"" | "png" | "pdf">("");
  const [qr, setQr] = useState<{ href: string; image: string }>();
  const [qrError, setQrError] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let live = true;
    const href = new URL(link, window.location.origin).href;
    QRCode.toDataURL(href, { width: 240, margin: 2, errorCorrectionLevel: "M" }).then(
      image => { if (live) setQr({ href, image }); },
      () => { if (live) setQrError(true); },
    );
    return () => { live = false; };
  }, [link]);

  useEffect(() => {
    if (!qr) return;
    let live = true;
    QRCode.toDataURL(qr.href, { width: 640, margin: 4, errorCorrectionLevel: "M", color: { dark: colors[ink], light: colors[paper] } }).then(
      image => { if (live) setPreview(image); },
      () => { if (live) setStatus("Couldn’t generate the QR preview. Try another preset."); },
    );
    return () => { live = false; };
  }, [qr, ink, paper]);

  function chooseInk(value: typeof ink) {
    setInk(value);
    if (value === paper) setPaper(value === "black" ? "white" : "black");
  }
  function choosePaper(value: typeof paper) {
    setPaper(value);
    if (value === ink) setInk(value === "black" ? "white" : "black");
  }
  async function download(format: "png" | "pdf") {
    if (!qr) return;
    setBusy(format);
    try {
      const data = await QRCode.toDataURL(qr.href, { width: 1200, margin: 4, errorCorrectionLevel: "M", color: { dark: format === "pdf" ? colors.black : colors[ink], light: format === "pdf" ? colors.white : colors[paper] } });
      let blob = await (await fetch(data)).blob();
      if (format === "pdf") {
        const { PDFDocument } = await import("pdf-lib");
        const pdf = await PDFDocument.create();
        pdf.setTitle("Participant registration QR code");
        const image = await pdf.embedPng(await blob.arrayBuffer());
        pdf.addPage([612, 792]).drawImage(image, { x: 36, y: 216, width: 540, height: 540 });
        blob = new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" });
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `registration-qr.${format}`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("QR code downloaded.");
      toast("QR code downloaded.");
    } catch {
      setStatus("Couldn’t download the QR code. Try again.");
      toast("Couldn’t download the QR code. Try again.", "error");
    } finally { setBusy(""); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(link, window.location.origin).href);
      setStatus("Registration link copied.");
      toast("Registration link copied.");
    } catch {
      const message = "Couldn’t copy the link. Select it and copy it manually.";
      setStatus(message);
      toast(message, "error");
    }
  }

  return <section className="ev-registration-share" aria-label="Share participant registration">
    <div className="ev-registration-share-details">
      <h3>Registration form</h3>
      <div className="ev-registration-share-link">
        <a href={qr?.href ?? link}>{qr?.href ?? link}</a>
        <button type="button" className="ev-button is-ghost" onClick={() => void copy()} aria-label="Copy registration link" title="Copy registration link">
          {status === "Registration link copied." ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        </button>
      </div>
      <p>Share this link or QR code with your participants. Each participant must register individually.</p>
      <span className="ev-registration-share-status" role="status">{status}</span>
    </div>
    <div className="ev-registration-share-qr">
      {qr ? <button type="button" className="ev-registration-qr-button" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog" aria-label="Open registration QR code downloads">
        {/* eslint-disable-next-line @next/next/no-img-element -- Locally generated QR image. */}
        <img src={qr.image} width={160} height={160} alt="QR code for the participant registration form" />
        <span>View and download</span>
      </button> : <p>{qrError ? "Couldn’t generate the QR code. Share the link instead." : "Preparing QR code…"}</p>}
    </div>
    <dialog ref={dialog} className="ev-share-dialog" aria-labelledby={titleId} onCancel={event => { if (busy) event.preventDefault(); }} onClick={event => {
      if (event.target !== event.currentTarget || busy) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close();
    }}>
      <header><h2 id={titleId}>Registration QR code</h2><button type="button" className="ev-button is-ghost" aria-label="Close QR code downloads" disabled={!!busy} onClick={() => dialog.current?.close()} autoFocus><X size={16} aria-hidden="true" /></button></header>
      <div className={`ev-share-qr-preview is-ink-${ink}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Locally generated QR image. */}
        {preview && <img src={preview} width={280} height={280} alt="QR code in the selected download colours" />}
      </div>
      <fieldset className="ev-share-presets"><legend>Code colour</legend>{(["black", "white"] as const).map(value => <label key={value}><input type="radio" name={`${titleId}-ink`} checked={ink === value} onChange={() => chooseInk(value)} />{value === "black" ? "Black" : "White"}</label>)}</fieldset>
      <fieldset className="ev-share-presets"><legend>Background</legend>{(["transparent", "white", "black"] as const).map(value => <label key={value}><input type="radio" name={`${titleId}-paper`} checked={paper === value} onChange={() => choosePaper(value)} />{value === "transparent" ? "Transparent" : value === "white" ? "White" : "Black"}</label>)}</fieldset>
      <p className="ev-share-pdf-note">PNG uses your selected colours. PDF prints a black code on a white Letter page.</p>
      <div className="ev-share-dialog-actions">
        <button type="button" className="ev-button is-ghost" onClick={() => void copy()}><Copy size={16} aria-hidden="true" />Copy link</button>
        <button type="button" className="ev-button is-ghost" disabled={!!busy || !qr} onClick={() => void download("pdf")}><FileText size={16} aria-hidden="true" />{busy === "pdf" ? "Saving…" : "Download PDF"}</button>
        <button type="button" className="ev-button is-primary" disabled={!!busy || !preview} onClick={() => void download("png")}><Download size={16} aria-hidden="true" />{busy === "png" ? "Saving…" : "Download PNG"}</button>
      </div>
      <span className="ev-registration-share-status" role="status">{status}</span>
    </dialog>
  </section>;
}

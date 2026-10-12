"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "@/components/portal/toast";

export function RegistrationShare({ link }: { link: string }) {
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
      <h3>Registration Form</h3>
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
      {qr ? <>
        {/* eslint-disable-next-line @next/next/no-img-element -- Locally generated QR image. */}
        <img src={qr.image} width={160} height={160} alt="QR code for the participant registration form" />
      </> : <p>{qrError ? "Couldn’t generate the QR code. Share the link instead." : "Preparing QR code…"}</p>}
    </div>
  </section>;
}

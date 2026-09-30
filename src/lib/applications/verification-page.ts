import "server-only";

import { NextResponse } from "next/server";
import { VERIFICATION_CHANNEL, type VerificationMessage, type VerificationStatus, type VerifiedProfile } from "./verification-channel";

// The last page of UST verification. Verification usually runs in a popup: this page tells the
// form how it went over a BroadcastChannel (Google's sign-in cuts the popup's window.opener link,
// so postMessage to the opener isn't reliable), then closes itself. Opened as a normal page instead
// (popup blocked), it can't close, so it carries on to `fallback`.

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** The page for any verification flow: `message` goes out on `channel`, and `ok` picks the text. */
export function finishPage({ channel, message, ok, fallback, backLabel }: { channel: string; message: unknown; ok: boolean; fallback: string; backLabel: string }) {
  // JSON inside a <script>: escape "<" so the data can never close the tag.
  const data = JSON.stringify(message).replace(/</g, "\\u003c");
  const text = ok ? "You’re verified. You can close this window." : "Verification didn’t complete. You can close this window and try again.";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UST verification</title>
<style>body{align-items:center;background:#f6f4ef;color:#1d1c1b;display:flex;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;justify-content:center;margin:0;min-height:100vh;padding:24px;text-align:center}a{color:#1d1c1b}</style>
</head><body><p>${escapeHtml(text)} <a href="${escapeHtml(fallback)}">${escapeHtml(backLabel)}</a></p>
<script>
(function () {
  var message = ${data};
  try { var channel = new BroadcastChannel(${JSON.stringify(channel)}); channel.postMessage(message); channel.close(); } catch (error) {}
  window.close();
  // Still open: this wasn't a popup (or the browser won't close it), so continue in this window.
  setTimeout(function () { location.replace(${JSON.stringify(fallback)}); }, 400);
})();
</script></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export function verificationFinishPage(status: VerificationStatus, profile: VerifiedProfile | null = null) {
  return finishPage({
    channel: VERIFICATION_CHANNEL,
    message: { status, profile } satisfies VerificationMessage,
    ok: status === "ok",
    fallback: `/apply?verify=${status}`,
    backLabel: "Back to the application",
  });
}

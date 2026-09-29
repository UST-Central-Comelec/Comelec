import "server-only";

import { NextResponse } from "next/server";
import { VERIFICATION_CHANNEL, type VerificationMessage, type VerificationStatus, type VerifiedProfile } from "./verification-channel";

// The last page of UST verification. Verification usually runs in a popup: this page tells the
// application form how it went over a BroadcastChannel (Google's sign-in cuts the popup's
// window.opener link, so postMessage to the opener isn't reliable), then closes itself. Opened as
// a normal page instead (popup blocked), it can't close, so it carries on to /apply.

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function verificationFinishPage(status: VerificationStatus, profile: VerifiedProfile | null = null) {
  // JSON inside a <script>: escape "<" so the data can never close the tag.
  const message = JSON.stringify({ status, profile } satisfies VerificationMessage).replace(/</g, "\\u003c");
  const fallback = `/apply?verify=${status}`;
  const text = status === "ok" ? "You’re verified. You can close this window." : "Verification didn’t complete. You can close this window and try again.";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>UST verification</title>
<style>body{align-items:center;background:#f6f4ef;color:#1d1c1b;display:flex;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;justify-content:center;margin:0;min-height:100vh;padding:24px;text-align:center}a{color:#1d1c1b}</style>
</head><body><p>${escapeHtml(text)} <a href="${fallback}">Back to the application</a></p>
<script>
(function () {
  var message = ${message};
  try { var channel = new BroadcastChannel(${JSON.stringify(VERIFICATION_CHANNEL)}); channel.postMessage(message); channel.close(); } catch (error) {}
  window.close();
  // Still open: this wasn't a popup (or the browser won't close it), so continue in this window.
  setTimeout(function () { location.replace(${JSON.stringify(fallback)}); }, 400);
})();
</script></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

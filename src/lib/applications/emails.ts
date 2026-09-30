import "server-only";

import type { Email } from "@/lib/email/send";

// The emails applicants get: a confirmation when they submit, and the result when a commissioner
// accepts or rejects them in the portal. Plain layout so they read well in any mail app.

export const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

/** Wraps paragraphs in a simple, centred card with the commission's name on top. */
export function layout(paragraphs: string[], code?: string) {
  const body = paragraphs.map((text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1d1c1b">${text}</p>`).join("");
  const codeBlock = code
    ? `<div style="background:#1d1c1b;border-radius:10px;color:#fff;margin:0 0 20px;padding:16px 20px"><div style="color:#b5b5b5;font-size:12px">Reference code</div><div style="font-size:24px;font-weight:700;letter-spacing:.06em;margin-top:4px">${escape(code)}</div></div>`
    : "";
  return `<!doctype html><html><body style="background:#f6f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;margin:0;padding:24px 12px">
<div style="background:#fff;border:1px solid #e5e2da;border-radius:14px;margin:0 auto;max-width:560px;padding:28px">
<div style="border-bottom:3px solid #d4a017;font-size:13px;font-weight:700;letter-spacing:.08em;margin:0 0 24px;padding-bottom:14px;text-transform:uppercase">UST Central Comelec</div>
${codeBlock}${body}
<p style="color:#6b6b75;font-size:13px;line-height:1.6;margin:24px 0 0">UST Central Commission on Elections · <a href="mailto:comelec@ust.edu.ph" style="color:#6b6b75">comelec@ust.edu.ph</a></p>
</div></body></html>`;
}

type Applicant = { email: string; firstName: string; referenceCode: string; position: string; division: string };

/** Names are stored in capitals; "JUAN PAOLO" reads better as "Juan Paolo" in a greeting. */
export const greetingName = (name: string) => name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

export function confirmationEmail(applicant: Applicant, interview: string | null = null): Email {
  const trackUrl = `${siteUrl()}/apply/track?ref=${applicant.referenceCode}`;
  const intro = `Thank you for applying for ${applicant.position} in the ${applicant.division}. We’ve received your application, and it’s now pending review.`;
  const interviewLine = interview ? `Your interview: ${interview}. Please be on time; we’ll email you if anything changes.` : null;
  const lines = [
    `Hi ${greetingName(applicant.firstName)},`,
    intro,
    ...(interviewLine ? [interviewLine] : []),
    `Keep your reference code. To check on your application, go to Track application and enter it with your student number: ${trackUrl}`,
    `We’ll email you again once the commission has reached a decision.`,
  ];
  return {
    to: applicant.email,
    subject: `Application received (${applicant.referenceCode})`,
    text: `${lines.join("\n\n")}\n\nReference code: ${applicant.referenceCode}\n\nUST Central Commission on Elections`,
    html: layout([
      escape(lines[0]),
      escape(intro),
      ...(interview ? [`<strong>Your interview:</strong> ${escape(interview)}. Please be on time; we’ll email you if anything changes.`] : []),
      `Keep your reference code. To check on your application, go to <a href="${escape(trackUrl)}" style="color:#1d1c1b">Track application</a> and enter it with your student number.`,
      escape(lines[lines.length - 1]),
    ], applicant.referenceCode),
  };
}

export function resultEmail(applicant: Applicant, accepted: boolean): Email {
  const lines = accepted
    ? [
        `Hi ${greetingName(applicant.firstName)},`,
        `Congratulations! You’ve been accepted as ${applicant.position} in the ${applicant.division}.`,
        `The commission will reach out soon with your next steps. Welcome to the UST Central Comelec.`,
      ]
    : [
        `Hi ${greetingName(applicant.firstName)},`,
        `Thank you for applying for ${applicant.position} in the ${applicant.division}. After careful review, we won’t be moving forward with your application this time.`,
        `We appreciate your interest in serving the Thomasian community, and we hope you’ll apply again in a future cycle.`,
      ];
  return {
    to: applicant.email,
    subject: accepted ? `You’re in! Your Central COMELEC application (${applicant.referenceCode})` : `Your Central COMELEC application (${applicant.referenceCode})`,
    text: `${lines.join("\n\n")}\n\nReference code: ${applicant.referenceCode}\n\nUST Central Commission on Elections`,
    html: layout(lines.map(escape), applicant.referenceCode),
  };
}

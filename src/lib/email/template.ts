// What every email the commission sends is built from: the COMET look of the website and the portal
// (deep-space black, a glass card, UST gold for what matters, a gold serif italic for accent words),
// written the way mail apps need it: tables for layout and every style inline.
//
// Only the card is dark; around it the mail app's own background shows. Mail apps with a dark mode
// of their own (Gmail on a phone, above all) recolour what they think is a light email, and would
// turn this card's light text dark. Three habits keep it as designed:
//   • every dark or gold fill is also a gradient (`fill`), which they leave alone;
//   • light text sits in two blend layers (`ink`), which cancel the recolouring out;
//   • gold text is cut out of a gold gradient by the same layers (`tint`), as Gmail would dim it;
//   • hairlines are thin filled rows rather than borders, which they would turn white.
//
// Free of server-only imports: the Email Sender draws its preview in the browser with the same code
// the server sends with.

export const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
}

/** Names are stored in capitals; "JUAN PAOLO" reads better as "Juan Paolo" in a greeting. */
export const greetingName = (name: string) => name.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());

export const COMMISSION = "UST Central Commission on Elections";
export const COMMISSION_EMAIL = "comelec@ust.edu.ph";

/** The seal travels inside each email (src/lib/email/send.ts attaches it under this name), so it shows without the mail app fetching anything. */
export const LOGO_CID = "comelec-seal";
/** The same image on the website, for a preview drawn in the browser. */
export const LOGO_PATH = "/images/email-logo.png";

/** The website's night colours (portal.css), as the solid values a mail app can draw. */
export const palette = {
  bg: "#030305",
  panel: "#0c0c12",
  raised: "#14141c",
  line: "#22222c",
  lineStrong: "#30303c",
  text: "#f3f1eb",
  soft: "#cfcdd6",
  muted: "#a3a1ac",
  faint: "#7e7c87",
  gold: "#fec30c",
  goldInk: "#f1cf6b",
  onGold: "#0c0b08",
  ok: "#3ecf8e",
  okInk: "#7be3b4",
} as const;

const sans = "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const serif = "'Instrument Serif','Iowan Old Style',Georgia,'Times New Roman',serif";

const fill = (colour: string, to = colour) => `background:${colour};background-image:linear-gradient(180deg,${colour},${to})`;

/**
 * Light text that stays light in a mail app's dark mode. Gmail turns the two layers' black
 * backgrounds white and the text dark, and the blends turn both back; elsewhere the layers do nothing.
 * The classes are defined in `shell`. `style` is the text's own.
 */
const ink = (html: string, style: string, margin = "0") => `<div class="em-s" style="margin:${margin}"><div class="em-d" style="${style}">${html}</div></div>`;

/** The same, for words inside a line. */
const inkInline = (html: string) => `<span class="em-s"><span class="em-d">${html}</span></span>`;

/** The colours `tint` can draw; each has a class in `shell`. */
const tints = { gold: palette.gold, ok: palette.ok } as const;
type Tint = keyof typeof tints;

/**
 * Coloured text that keeps its colour in a mail app's dark mode. Gmail dims coloured text (gold to a
 * muddy brown), and `ink`'s layers alone would turn it to its opposite, so in Gmail the text is drawn
 * white and used as a stencil: `ink`'s two layers keep it white on black in either mode, a colour burn
 * over near-white lifts it back to full strength (Gmail's dark mode leaves it a little grey), and it's
 * multiplied over a gradient of the colour, which Gmail leaves alone, then screened onto the card.
 * Elsewhere none of the layers do anything and it's plain coloured text. `style` is the text's own.
 */
const tint = (html: string, colour: Tint, style = "", tag: "span" | "div" = "span") =>
  `<${tag} class="em-t-${colour}"><${tag} class="em-t"><${tag} class="em-k"><${tag} class="em-d em-w" style="color:${tints[colour]};${style}">${html}</${tag}></${tag}></${tag}></${tag}>`;

/** A hairline across a table of `columns` columns. */
const ruleRow = (columns = 1) => `<tr><td${columns > 1 ? ` colspan="${columns}"` : ""} height="1" style="${fill(palette.line)};font-size:0;height:1px;line-height:0">&nbsp;</td></tr>`;

/** One paragraph. `html` is HTML: escape anything that came from a person. */
export const paragraph = (html: string) => ink(html, `color:${palette.soft};font-size:15px;line-height:1.65`, "0 0 16px");

/** A paragraph of smaller, quieter text: a caveat, who to ask. */
export const note = (html: string) => ink(html, `color:${palette.muted};font-size:13px;line-height:1.6`, "0 0 16px");

/** A link inside a paragraph: the text's own colour, underlined. */
export const link = (href: string, label: string) => `<a href="${escape(href)}" style="color:${palette.text};font-weight:500;text-decoration:underline">${label}</a>`;

/** Words that stand out in a paragraph. */
export const strong = (html: string) => `<strong style="color:${palette.text};font-weight:600">${html}</strong>`;

/**
 * A lit panel with a small label over a large value: a reference code (in gold, the default), or a
 * name such as an event's or a position's ("name").
 */
export function highlight(label: string, value: string, kind: "code" | "name" = "code") {
  const shown = kind === "code" ? `<div style="margin-top:6px">${tint(escape(value), "gold", "font-size:26px;font-weight:600;line-height:1.2", "div")}</div>` : ink(escape(value), `color:${palette.text};font-size:19px;font-weight:600;line-height:1.35`, "6px 0 0");
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;margin:0 0 22px"><tr><td style="${fill("#1d1d27", "#15151d")};border-radius:16px;padding:18px 22px">
${ink(escape(label), `color:${palette.muted};font-size:12px;font-weight:500;line-height:1.3`)}
${shown}
</td></tr></table>`;
}

/** The email's one main action: a dark pill with a gold edge. */
export const button = (label: string, href: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:6px 0 24px"><tr><td style="${fill(palette.gold)};border-radius:999px;padding:1px"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="${fill("#1a1a23", "#111118")};border-radius:999px"><a href="${escape(href)}" style="color:${palette.text};display:block;padding:12px 24px;text-decoration:none">${ink(`${escape(label)}&nbsp;&rarr;`, `color:${palette.text};font-size:14px;font-weight:600;line-height:1.2`)}</a></td></tr></table></td></tr></table>`;

/** A small pill with a dot: where something stands. */
export function status(label: string, tone: "gold" | "ok" = "gold") {
  const back = tone === "ok" ? "#12291f" : "#2a220d";
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 20px"><tr><td style="${fill(back)};border-radius:999px;padding:7px 13px 7px 11px"><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr><td style="font-size:10px;line-height:1;padding-right:7px">${tint("&#9679;", tone)}</td><td>${ink(escape(label), `color:${palette.text};font-size:12px;font-weight:500;line-height:1`)}</td></tr></table></td></tr></table>`;
}

/** A row's value is text; with `href` it's a link (a file that was shared, a page to open). */
export type Details = Array<[label: string, value: string, href?: string]>;

/** The rows that have a value: one left empty (a detail the account doesn't have) isn't shown. */
const filled = (rows: Details) => rows.filter(([, value]) => value.trim());

/** A spec sheet: a label, its value beside it, a hairline between rows. A long value (an address, a link) wraps rather than widening the email. */
export const details = (rows: Details) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 22px">${filled(rows)
    .map(
      ([label, value, href]) =>
        `${ruleRow(2)}<tr><td width="112" style="padding:11px 18px 11px 0;vertical-align:top;width:112px">${ink(escape(label), `color:${palette.muted};font-size:13px;line-height:1.5`)}</td><td style="padding:11px 0;vertical-align:top;word-break:break-word">${ink(href ? link(href, escape(value)) : escape(value), `color:${palette.text};font-size:14px;line-height:1.5`)}</td></tr>`,
    )
    .join("")}</table>`;

export const detailsText = (rows: Details) => filled(rows).map(([label, value, href]) => `${label}: ${value}${href && href !== value ? ` (${href})` : ""}`).join("\n");

/** Someone's own words, set off by a gold rule. Line breaks are kept. */
export const quote = (text: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 20px"><tr><td width="3" style="${fill(palette.gold)};border-radius:3px;font-size:0;line-height:0;width:3px">&nbsp;</td><td style="padding:2px 0 2px 16px">${ink(escape(text), `color:${palette.text};font-size:15px;line-height:1.65;white-space:pre-line`)}</td></tr></table>`;

/**
 * A list. Each item is HTML. Drawn as rows, with the marker in gold in a column of its own, because
 * mail apps don't agree on how a list's own markers look.
 */
export function list(items: string[], ordered = false) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 16px">${items
    .map((item, index) => `<tr><td width="26" style="font-size:${ordered ? 14 : 15}px;font-weight:600;line-height:1.65;padding:0 0 8px;vertical-align:top;width:26px">${tint(ordered ? `${index + 1}.` : "&bull;", "gold")}</td><td style="padding:0 0 8px;vertical-align:top">${ink(item, `color:${palette.soft};font-size:15px;line-height:1.65`)}</td></tr>`)
    .join("")}</table>`;
}

/** A small heading over a group of blocks: "What happens next". */
export const heading = (text: string) => ink(escape(text), `color:${palette.text};font-size:14px;font-weight:600;line-height:1.4`, "6px 0 12px");

export const divider = () => `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:6px 0 22px">${ruleRow()}</table>`;

/**
 * A title, with the words between *asterisks* set in the website's gold serif italic:
 * "We’ve received your *application*". Everything else is escaped.
 */
export function accent(title: string) {
  return title
    .split(/\*([^*]+)\*/)
    .map((part, index) => (index % 2 ? `<em style="font-family:${serif};font-size:1.08em;font-style:italic;font-weight:400">${tint(escape(part), "gold")}</em>` : part && inkInline(escape(part))))
    .join("");
}

/** A title as plain text, for the text version of an email. */
export const plainTitle = (title: string) => title.replace(/\*([^*]+)\*/g, "$1");

export type Shell = {
  /** The small label over the title: what the email is about. */
  eyebrow?: string;
  /** The email's heading. Mark accent words with *asterisks* (see `accent`). */
  title?: string;
  /** Ready-made blocks (paragraph, highlight, button…), top to bottom. */
  blocks: string[];
  /** The line a mail app shows beside the subject in its list. */
  preheader?: string;
  /** Where the seal comes from. The default is the copy attached to the email. */
  logoSrc?: string;
};

/** What stands outside the card, on the mail app's own background, light or dark: a grey both can show. */
const OUTSIDE = "#85838f";

/**
 * A whole email: one dark card, with a comet's gold streak along its top edge, the commission's
 * seal and name at its head and the message under them; then the footer, on the mail app's own
 * background.
 */
export function shell({ eyebrow, title, blocks, preheader, logoSrc = `cid:${LOGO_CID}` }: Shell) {
  const home = siteUrl();
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&amp;family=Instrument+Serif:ital@1&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0}
u + .body .em-s{background:#000;mix-blend-mode:screen}
u + .body .em-d{background:#000;mix-blend-mode:difference}
u + .body .em-w{color:#fff!important}
u + .body .em-k{background:#000;mix-blend-mode:color-burn}
u + .body .em-t{background-image:linear-gradient(#f8f8f8,#f8f8f8);mix-blend-mode:multiply}
${Object.entries(tints).map(([name, colour]) => `u + .body .em-t-${name}{background-image:linear-gradient(${colour},${colour});mix-blend-mode:screen}`).join("\n")}
@media (max-width:620px){.em-pad{padding-left:24px!important;padding-right:24px!important}.em-title{font-size:27px!important}.em-outer{padding:14px 8px 28px!important}}
</style>
</head>
<body class="body" style="margin:0;padding:0;-webkit-text-size-adjust:100%">
${preheader ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escape(preheader)}</div>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:${sans}">
<tr><td align="center" class="em-outer" style="padding:28px 14px 40px">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="border-collapse:separate;max-width:600px;width:100%">
<tr><td style="${fill(palette.lineStrong, palette.line)};border-radius:22px;padding:1px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate">
<tr><td style="${fill("#12121a", "#08080d")};border-radius:21px">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">
<tr><td style="font-size:0;line-height:0;padding:0 34px"><div style="background:${palette.gold};background-image:linear-gradient(90deg,#12121a,${palette.gold} 22%,#ffe28a 50%,${palette.gold} 78%,#12121a);font-size:0;height:2px;line-height:0">&nbsp;</div></td></tr>
<tr><td class="em-pad" style="padding:24px 38px 22px">
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>
<td style="padding-right:13px;vertical-align:middle"><a href="${escape(home)}" style="text-decoration:none"><img src="${escape(logoSrc)}" width="44" height="44" alt="" style="border:0;border-radius:50%;display:block;height:44px;width:44px"></a></td>
<td style="vertical-align:middle">${ink("UST Central COMELEC", `color:${palette.text};font-size:15px;font-weight:600;line-height:1.25`)}${ink("Central Commission on Elections", `color:${palette.muted};font-size:12px;line-height:1.4`, "2px 0 0")}</td>
</tr></table>
</td></tr>
<tr><td class="em-pad" style="padding:0 38px"><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">${ruleRow()}</table></td></tr>
<tr><td class="em-pad" style="padding:30px 38px 20px">
${eyebrow ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 14px"><tr><td style="font-size:9px;line-height:1;padding-right:8px">${tint("&#9632;", "gold")}</td><td>${ink(escape(eyebrow), `color:${palette.muted};font-size:12.5px;font-weight:500;line-height:1.3`)}</td></tr></table>` : ""}
${title ? `<h1 class="em-title" style="color:${palette.text};font-size:32px;font-weight:600;line-height:1.14;margin:0 0 24px">${accent(title)}</h1>` : ""}
${blocks.join("\n")}
</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="color:${OUTSIDE};font-size:12.5px;line-height:1.65;padding:22px 8px 0;text-align:center">
<div>${COMMISSION}</div>
<div>UST Tan Yan Kee Student Center, España Boulevard, Manila</div>
<div style="margin-top:8px"><a href="mailto:${COMMISSION_EMAIL}" style="color:${OUTSIDE};text-decoration:underline">${COMMISSION_EMAIL}</a>&nbsp;&nbsp;&middot;&nbsp;&nbsp;<a href="${escape(home)}" style="color:${OUTSIDE};text-decoration:underline">Website</a></div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

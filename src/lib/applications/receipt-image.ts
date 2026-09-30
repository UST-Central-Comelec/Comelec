// The Receipt step's "Download receipt": the saved application (or portal access request) drawn on
// a canvas and saved as a PNG, so people keep their reference code somewhere other than the page.
// Browser only.

/** What a receipt shows: the code, when it was sent, and every answer a section at a time. */
export type ReceiptData = { referenceCode: string; submittedAt: string; answers: Array<{ title: string; rows: Array<[string, string]> }> };

/** The words that differ between an application's receipt and an access request's. */
export type ReceiptLabels = { kind: string; heading: string; subject: string };

const applicationLabels: ReceiptLabels = { kind: "Application receipt", heading: "Application received", subject: "application" };

const WIDTH = 680;
const PADDING = 44;
/** Width of the answer labels' column. */
const LABEL_WIDTH = 170;
const SCALE = 2;
const INNER = WIDTH - PADDING * 2;
const LOGO_SRC = "/images/Logo-1.png";

const ink = "#000";
const muted = "#555";
const line = "#dedede";
const gold = "#fec30c";

type Draw = (ctx: CanvasRenderingContext2D) => void;

/** Cuts a word wider than `maxWidth` (a long link, say) into pieces that fit. */
function breakWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number) {
  const pieces: string[] = [];
  let current = "";
  for (const char of word) {
    if (current && ctx.measureText(current + char).width > maxWidth) {
      pieces.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Splits text into lines no wider than `maxWidth` in the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  const words = text.split(/\s+/).flatMap((word) => (ctx.measureText(word).width > maxWidth ? breakWord(ctx, word, maxWidth) : [word]));
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

const formatSubmitted = (iso: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Draws the receipt as a PNG, in the page's own font. */
export async function renderReceipt(result: ReceiptData, trackUrl: string, labels: ReceiptLabels = applicationLabels) {
  await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const font = (weight: number, size: number, face = family) => `${weight} ${size}px ${face}`;
  const logo = await loadImage(LOGO_SRC);

  // Lay out once to learn the height, drawing into a list, then paint on a canvas of that size.
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("Canvas isn’t available.");
  const ops: Draw[] = [];
  let y = 0;

  // Gold band across the top.
  ops.push((ctx) => { ctx.fillStyle = gold; ctx.fillRect(0, 0, WIDTH, 8); });
  y = 8 + PADDING;

  // Header: logo and the commission's name.
  const logoSize = 60;
  const headerY = y;
  if (logo) ops.push((ctx) => ctx.drawImage(logo, PADDING, headerY, logoSize, logoSize));
  const textX = logo ? PADDING + logoSize + 16 : PADDING;
  ops.push((ctx) => {
    ctx.fillStyle = ink;
    ctx.font = font(700, 19, "Georgia, serif");
    ctx.fillText("UST Central Comelec", textX, headerY + 27);
    ctx.fillStyle = muted;
    ctx.font = font(400, 13);
    ctx.fillText(`Commission on Elections · ${labels.kind}`, textX, headerY + 48);
  });
  y += logoSize + 28;

  // Heading.
  const headingY = y;
  ops.push((ctx) => {
    ctx.fillStyle = ink;
    ctx.font = font(600, 24);
    ctx.fillText(labels.heading, PADDING, headingY + 24);
  });
  y += 44;

  // Reference code, in the same black block as the page.
  const codeY = y;
  const codeHeight = 92;
  ops.push((ctx) => {
    ctx.fillStyle = ink;
    roundedRect(ctx, PADDING, codeY, INNER, codeHeight, 14);
    ctx.fillStyle = "rgba(255,255,255,.6)";
    ctx.font = font(500, 12);
    ctx.fillText("Your reference code", PADDING + 22, codeY + 32);
    ctx.fillStyle = gold;
    ctx.font = font(600, 30);
    ctx.fillText(result.referenceCode.split("").join(String.fromCharCode(8202)), PADDING + 22, codeY + 70);
  });
  y += codeHeight + 26;

  // Every answer, a section at a time: label on the left, value on the right.
  const sections = [{ title: "Submission", rows: [["Submitted", formatSubmitted(result.submittedAt)]] as Array<[string, string]> }, ...result.answers];
  const valueX = PADDING + LABEL_WIDTH;
  const valueWidth = INNER - LABEL_WIDTH;
  for (const section of sections) {
    const titleY = y;
    ops.push((ctx) => {
      ctx.fillStyle = ink;
      ctx.font = font(600, 13);
      ctx.fillText(section.title.toUpperCase(), PADDING, titleY + 13);
      ctx.fillStyle = line;
      ctx.fillRect(PADDING, titleY + 24, INNER, 1);
    });
    y += 40;
    for (const [label, value] of section.rows) {
      const empty = !value.trim();
      const valueFont = empty ? font(400, 14) : font(500, 14);
      measure.font = valueFont;
      const lines = wrap(measure, empty ? "Not provided" : value, valueWidth);
      measure.font = font(400, 13);
      const labelLines = wrap(measure, label, LABEL_WIDTH - 16);
      const rowY = y;
      ops.push((ctx) => {
        ctx.fillStyle = muted;
        ctx.font = font(400, 13);
        labelLines.forEach((text, index) => ctx.fillText(text, PADDING, rowY + 14 + index * 19));
        ctx.fillStyle = empty ? muted : ink;
        ctx.font = valueFont;
        lines.forEach((text, index) => ctx.fillText(text, valueX, rowY + 14 + index * 21));
      });
      y += Math.max(lines.length * 21, labelLines.length * 19) + 12;
    }
    y += 16;
  }

  // How to track it.
  const noteY = y;
  const note = `Keep this receipt. To check on your ${labels.subject}, go to ${trackUrl} and enter your reference code with your student number.`;
  measure.font = font(400, 13);
  const noteLines = wrap(measure, note, INNER - 36);
  const noteHeight = 28 + noteLines.length * 20;
  ops.push((ctx) => {
    ctx.fillStyle = "#f7f7f7";
    roundedRect(ctx, PADDING, noteY, INNER, noteHeight, 12);
    ctx.fillStyle = muted;
    ctx.font = font(400, 13);
    noteLines.forEach((text, index) => ctx.fillText(text, PADDING + 18, noteY + 32 + index * 20));
  });
  y += noteHeight + PADDING;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * SCALE;
  canvas.height = Math.ceil(y * SCALE);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn’t available.");
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, y);
  ctx.textBaseline = "alphabetic";
  for (const op of ops) op(ctx);

  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn’t create the image."))), "image/png"));
}

/** Renders the receipt and saves it as CentralComelec-<code>.png. */
export async function downloadReceipt(result: ReceiptData, labels?: ReceiptLabels) {
  const blob = await renderReceipt(result, `${window.location.host}/apply/track`, labels);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `CentralComelec-${result.referenceCode}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before the URL is released.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

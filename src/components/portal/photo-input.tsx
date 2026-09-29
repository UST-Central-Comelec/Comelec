"use client";

import { useRef, useState, type ChangeEvent } from "react";

// Photo picker that shrinks the image in the browser before it's sent: resized to at most
// MAX_SIDE pixels and re-encoded as JPEG, lowering quality until it fits under 1 MB. Member
// photos are shown at most ~200px wide, so this is invisible on the site.

const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 1200;
const QUALITIES = [0.85, 0.75, 0.65, 0.55];

function formatSize(bytes: number) {
  return bytes >= MAX_BYTES ? `${(bytes / MAX_BYTES).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

async function compress(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));

  // Already small enough and not oversized: keep the original untouched.
  if (file.size <= MAX_BYTES && scale === 1) return file;

  for (let attempt = 0; attempt < 3; attempt++, scale *= 0.75) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff"; // JPEG has no transparency
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BYTES) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() });
      }
    }
  }
  throw new Error("too-large");
}

type Status = { kind: "idle" } | { kind: "working" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function PhotoInput({ name }: { name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return setStatus({ kind: "idle" });
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      event.target.value = "";
      return setStatus({ kind: "error", message: "Choose a JPG, PNG or WebP photo." });
    }

    setStatus({ kind: "working" });
    try {
      const compressed = await compress(file);
      // Swap the chosen file for the compressed one so the form submits the small version.
      const transfer = new DataTransfer();
      transfer.items.add(compressed);
      if (input.current) input.current.files = transfer.files;
      setStatus({ kind: "done", message: compressed === file ? `Ready · ${formatSize(file.size)}` : `Compressed ${formatSize(file.size)} → ${formatSize(compressed.size)}` });
    } catch {
      event.target.value = "";
      setStatus({ kind: "error", message: "Couldn’t read that photo. Try a different file." });
    }
  };

  return (
    <>
      <input ref={input} name={name} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} />
      {status.kind === "working" && <span className="portal-field-hint" aria-live="polite">Compressing…</span>}
      {status.kind === "done" && <span className="portal-file-status" aria-live="polite">{status.message}</span>}
      {status.kind === "error" && <span className="portal-field-error" aria-live="polite">{status.message}</span>}
    </>
  );
}

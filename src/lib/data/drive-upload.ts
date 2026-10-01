import "server-only";

// PDFs uploaded from the portal go into a folder in the commission's own Google Drive. The site
// acts as that account through a refresh token made once by scripts/drive-setup.mjs. The scope is
// drive.file, so it can only touch files and folders it created, never the rest of the Drive.

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const PDF = "application/pdf";

const config = () => ({
  clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
});

export function isDriveUploadConfigured() {
  return Object.values(config()).every(Boolean);
}

let cached: { token: string; expiresAt: number } | null = null;

async function accessToken() {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { clientId, clientSecret, refreshToken } = config();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, refresh_token: refreshToken!, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) throw new Error(`Google Drive sign-in failed: ${data.error ?? response.status}`);
  cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/**
 * Opens an upload session for one PDF and returns its address. The browser sends the file straight
 * there, so it never passes through this server (whose request size limit is far below a PDF's).
 * The address is the only credential the browser gets: good for this one file, and tied to `origin`.
 */
export async function startDriveUpload(name: string, size: number, origin: string) {
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": PDF,
      "X-Upload-Content-Length": String(size),
      Origin: origin,
    },
    body: JSON.stringify({ name, mimeType: PDF, parents: [config().folderId] }),
    cache: "no-store",
  });
  const session = response.headers.get("location");
  if (!response.ok || !session) throw new Error(`Google Drive refused the upload: ${response.status} ${await response.text()}`);
  return session;
}

/**
 * Checks a finished upload really is a PDF in the documents folder, makes it viewable by anyone
 * with the link, and returns that link. Returns null when the file isn't one of ours.
 */
export async function publishDriveUpload(id: string) {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  const file = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`;

  const response = await fetch(`${file}?fields=mimeType,size,parents,trashed`, { headers, cache: "no-store" });
  if (!response.ok) return null;
  const meta = (await response.json()) as { mimeType?: string; size?: string; parents?: string[]; trashed?: boolean };
  if (meta.mimeType !== PDF || meta.trashed || !meta.parents?.includes(config().folderId!) || Number(meta.size) > MAX_DOCUMENT_BYTES) return null;

  const shared = await fetch(`${file}/permissions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
    cache: "no-store",
  });
  if (!shared.ok) throw new Error(`Couldn’t share the file: ${shared.status} ${await shared.text()}`);
  return `https://drive.google.com/file/d/${id}/view`;
}

import "server-only";

import { AwsClient } from "aws4fetch";

// File storage on Cloudflare R2, spoken to through its S3-compatible API. Supabase keeps the
// database and sign-in; every file lives here. Two buckets, because R2 makes a whole bucket public
// or none of it:
//   public  — member photos and event-form images. Served straight from R2_PUBLIC_URL when it's set
//             (a custom domain), otherwise through this site at /files/… (src/app/files/[...key]).
//   private — Political Party registration documents, only reachable through short signed links.
// Uploads always pass through this server, so the buckets need no CORS rules.

export type Bucket = "public" | "private";

const config = () => ({
  accountId: process.env.R2_ACCOUNT_ID ?? "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  public: process.env.R2_PUBLIC_BUCKET ?? "",
  private: process.env.R2_PRIVATE_BUCKET ?? "",
});

const publicBase = () => (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

/** Where the site serves public-bucket files itself when R2_PUBLIC_URL is blank. */
export const FILES_PATH = "/files/";

export function isR2Configured() {
  return Object.values(config()).every(Boolean);
}

let client: AwsClient | null = null;

function r2() {
  if (!isR2Configured()) throw new Error("File storage isn’t set up. Add the R2_ settings to the environment.");
  const { accessKeyId, secretAccessKey } = config();
  client ??= new AwsClient({ accessKeyId, secretAccessKey, service: "s3", region: "auto" });
  return client;
}

const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

function objectUrl(bucket: Bucket, key: string) {
  const settings = config();
  return new URL(`https://${settings.accountId}.r2.cloudflarestorage.com/${settings[bucket]}/${encodeKey(key)}`);
}

async function send(bucket: Bucket, key: string, init: RequestInit) {
  const response = await r2().fetch(objectUrl(bucket, key).toString(), { ...init, cache: "no-store" });
  if (!response.ok && !(init.method === "DELETE" && response.status === 404)) {
    throw new Error(`R2 ${init.method} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }
  return response;
}

export async function putObject(bucket: Bucket, key: string, body: Uint8Array, options: { contentType: string; cacheControl?: string }) {
  const headers: Record<string, string> = { "Content-Type": options.contentType };
  if (options.cacheControl) headers["Cache-Control"] = options.cacheControl;
  // Copy into a plain ArrayBuffer-backed view so the signer hashes the body (a Buffer from a pool would include unrelated bytes otherwise).
  await send(bucket, key, { method: "PUT", body: new Uint8Array(body), headers });
}

export async function deleteObjects(bucket: Bucket, keys: string[]) {
  await Promise.all(keys.map((key) => send(bucket, key, { method: "DELETE" })));
}

/** Fetches a public-bucket object for /files/…, passing on the browser's caching and range headers. */
export async function getPublicObject(key: string, request: Request) {
  const headers = new Headers();
  for (const name of ["if-none-match", "if-modified-since", "range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  return r2().fetch(objectUrl("public", key).toString(), { headers, cache: "no-store" });
}

/**
 * The address anyone can load a public-bucket object from: the custom domain when there is one,
 * otherwise this site's /files/… (kept relative, so it works on localhost and once deployed).
 */
export function publicObjectUrl(key: string) {
  const base = publicBase();
  return base ? `${base}/${encodeKey(key)}` : `${FILES_PATH}${encodeKey(key)}`;
}

/** The public-bucket key behind one of our own URLs (either form), or null for any other address. */
export function publicKeyFromUrl(url: string) {
  const base = publicBase();
  if (base && url.startsWith(`${base}/`)) return decodeURIComponent(url.slice(base.length + 1));
  if (url.startsWith(FILES_PATH)) return decodeURIComponent(url.slice(FILES_PATH.length));
  return null;
}

/** A link that downloads a private object for the next `seconds`, saved under `downloadName`. */
export async function signedDownloadUrl(key: string, seconds: number, downloadName: string) {
  const url = objectUrl("private", key);
  url.searchParams.set("X-Amz-Expires", String(seconds));
  url.searchParams.set("response-content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  const signed = await r2().sign(url.toString(), { method: "GET", aws: { signQuery: true } });
  return signed.url;
}

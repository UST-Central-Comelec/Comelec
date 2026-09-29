// HMAC-SHA256 signatures for small values kept in cookies, so the server can trust what it wrote
// earlier. Keyed from the Supabase secret key (server-only) plus a purpose, so a value signed for
// one purpose can't be replayed as another. Uses Web Crypto, so it runs anywhere.

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function key(purpose: string) {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!keys.has(purpose)) {
    keys.set(purpose, crypto.subtle.importKey("raw", encoder.encode(`${purpose}:${secret}`), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]));
  }
  return keys.get(purpose)!;
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function signature(purpose: string, payload: string) {
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(purpose), encoder.encode(payload))));
}

/** Constant-time comparison, so a signature can't be guessed a byte at a time. */
export function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/** `payload.signature`, for a payload with no dots in it. */
export async function signValue(purpose: string, payload: string) {
  return `${payload}.${await signature(purpose, payload)}`;
}

/** The payload if the signature matches, otherwise null. */
export async function verifyValue(purpose: string, value: string | undefined) {
  if (!value) return null;
  const cut = value.lastIndexOf(".");
  if (cut < 1) return null;
  const payload = value.slice(0, cut);
  return sameString(value.slice(cut + 1), await signature(purpose, payload)) ? payload : null;
}

/** Signs a JSON object as a cookie-safe string. */
export async function signJson(purpose: string, data: unknown) {
  return signValue(purpose, base64url(encoder.encode(JSON.stringify(data))));
}

export async function verifyJson<T>(purpose: string, value: string | undefined): Promise<T | null> {
  const payload = await verifyValue(purpose, value);
  if (!payload) return null;
  try {
    const binary = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))) as T;
  } catch {
    return null;
  }
}

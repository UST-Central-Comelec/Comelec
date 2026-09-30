// Reference codes look like CC-7K3M-9QXA: eight characters from an alphabet without look-alikes
// (no 0/O or 1/I), so they're easy to read back and type. 32^8 is about a trillion codes. The
// prefix says what it's for: CC for commissioner applications, PA for portal access requests.

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export type ReferencePrefix = "CC" | "PA";

export function newReferenceCode(prefix: ReferencePrefix = "CC") {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  // 256 is a multiple of 32, so every character is equally likely.
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * Turns whatever was typed ("cc 7k3m9qxa", "PA-7K3M-9QXA") into a code and what it's for, or null
 * if it can't be one. Eight characters with no prefix are taken as an application's.
 */
export function parseReferenceCode(input: string): { prefix: ReferencePrefix; code: string } | null {
  let chars = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  let prefix: ReferencePrefix = "CC";
  if (chars.length === 10 && (chars.startsWith("CC") || chars.startsWith("PA"))) {
    prefix = chars.slice(0, 2) as ReferencePrefix;
    chars = chars.slice(2);
  }
  if (chars.length !== 8) return null;
  return { prefix, code: `${prefix}-${chars.slice(0, 4)}-${chars.slice(4)}` };
}

/** Turns whatever the applicant typed ("cc 7k3m9qxa", "7K3M-9QXA") into CC-XXXX-XXXX, or null if it can't be one. */
export function normalizeReferenceCode(input: string) {
  const parsed = parseReferenceCode(input);
  return parsed?.prefix === "CC" ? parsed.code : null;
}

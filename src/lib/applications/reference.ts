// Reference codes look like CC-7K3M-9QXA: eight characters from an alphabet without look-alikes
// (no 0/O or 1/I), so they're easy to read back and type. 32^8 is about a trillion codes.

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newReferenceCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  // 256 is a multiple of 32, so every character is equally likely.
  const chars = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `CC-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/** Turns whatever the applicant typed ("cc 7k3m9qxa", "7K3M-9QXA") into CC-XXXX-XXXX, or null if it can't be one. */
export function normalizeReferenceCode(input: string) {
  let chars = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (chars.length === 10 && chars.startsWith("CC")) chars = chars.slice(2);
  if (chars.length !== 8) return null;
  return `CC-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

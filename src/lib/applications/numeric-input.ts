/** Identifiers stay strings so their leading zeroes are preserved. */
export function digitsOnly(value: string, length: number) {
  return value.replace(/[^0-9]/g, "").slice(0, length);
}

export function formatMobileNumber(value: string) {
  const digits = digitsOnly(value, 11);
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7)].filter(Boolean).join("-");
}

/** Keep the cursor by the same digit when formatting an edit in the middle of the number. */
export function formatNumericInput(input: HTMLInputElement, format: (value: string) => string) {
  const cursor = input.selectionStart ?? input.value.length;
  const digitCount = input.value.slice(0, cursor).replace(/[^0-9]/g, "").length;
  const formatted = format(input.value);
  if (formatted === input.value) return;
  input.value = formatted;
  let nextCursor = 0;
  let seen = 0;
  while (nextCursor < formatted.length && seen < digitCount) {
    if (/[0-9]/.test(formatted[nextCursor])) seen++;
    nextCursor++;
  }
  input.setSelectionRange(nextCursor, nextCursor);
}

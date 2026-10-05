/** The name shown in portal application lists and reviews. */
export function applicantDisplayName(parts: { lastName: string; firstName: string; middleName: string }) {
  const givenNames = [parts.firstName, parts.middleName].map((part) => part.trim()).filter(Boolean).join(" ");
  return [parts.lastName.trim(), givenNames].filter(Boolean).join(", ").toUpperCase();
}

/** Older applications only recorded a middle initial. */
export function applicantName(parts: { first_name: string; middle_name?: string | null; middle_initial?: string | null; last_name: string }) {
  const middle = parts.middle_name || (parts.middle_initial ? `${parts.middle_initial}.` : "");
  return [parts.first_name, middle, parts.last_name].filter(Boolean).join(" ");
}

/** A read can fall back to the recorded initial before migration 0033 is applied. */
export function isMiddleNameColumnMissing(error: { code?: string; message: string } | null) {
  return Boolean(error && error.message.includes("middle_name") && (error.code === "42703" || error.code === "PGRST204"));
}

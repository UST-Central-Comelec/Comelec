/** Display a person's recorded name parts without guessing where a surname begins. */
export function personDisplayName(parts: { lastName: string; firstName: string; middleName?: string | null }) {
  const givenNames = [parts.firstName, parts.middleName ?? ""].map(part => part.trim()).filter(Boolean).join(" ");
  return [parts.lastName.trim(), givenNames].filter(Boolean).join(", ").toUpperCase();
}

// What a certificate of candidacy needs, from the Elections Code (USEC 2011, Rule on the Certificate
// of Candidacy, Sections 6.2 and 6.3). Free of server-only imports.

export type CandidacyRequirement = { id: string; label: string; hint: string; optional?: boolean };

/** The documents filed with the certificate, each uploaded and reviewed on its own. */
export const candidacyRequirements: CandidacyRequirement[] = [
  { id: "certificate", label: "Certificate of candidacy", hint: "Sworn and signed. File the original, in duplicate, with the Comelec unit too." },
  { id: "photo", label: "Passport-sized photo", hint: "Your latest, in black and white. Bring 22 printed copies for a Central Student Council position, or at least 3 for a Local one." },
  { id: "transcript", label: "Transcript of records", hint: "With your general weighted average, certified by the Office of the Registrar." },
  { id: "goodMoral", label: "Certificate of good moral character", hint: "From the Office for Student Affairs for a Central Student Council position, or your Dean’s Office for a Local one." },
  { id: "schoolId", label: "Validated school ID", hint: "A clear copy of both sides." },
  { id: "registrationForm", label: "Current registration form", hint: "A clear copy." },
  { id: "program", label: "Program of government", hint: "If you have one.", optional: true },
];

export const isCandidacyRequirement = (id: string) => candidacyRequirements.some((item) => item.id === id);
export const candidacyRequirementLabel = (id: string) => candidacyRequirements.find((item) => item.id === id)?.label ?? id;

/** What the candidate swears to by filing (Section 6.2). */
export const oathDeclarations = [
  "I am announcing my candidacy for the office stated, and I am eligible for it.",
  "I will support and defend the constitution of my faculty, college, school or institute, or the CSC Constitution, as the case may be.",
  "I will obey the laws, legal orders and decrees promulgated by the constituted authorities.",
  "I assume the obligation of this oath voluntarily, without mental reservation or purpose of evasion.",
  "The facts stated in my certificate of candidacy are true to the best of my knowledge.",
] as const;

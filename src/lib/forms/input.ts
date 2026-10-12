// The input rules every form follows, in the browser (src/components/form-input-guard.tsx and the
// form builder's answer boxes) and on the server (src/lib/forms/fields.ts). AGENTS.md, "Names,
// numbers and emails", says what they are.

// Match complete emoji sequences without treating ordinary digits, #, or * as emoji.
const emoji = /[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0E\uFE0F\u20E3\u{E0020}-\u{E007F}]/gu;

/** A person's name as saved: letters (Ñ and accented ones too), single spaces between words, in capitals (no lowercase letter; scripts without case are letters too). */
export const personNamePattern = /^(?:(?!\p{Ll})\p{L}\p{M}*)+(?: (?:(?!\p{Ll})\p{L}\p{M}*)+)*$/u;
/** A UST student number: exactly 10 digits. */
export const studentNumberPattern = /^\d{10}$/;
/** A Philippine mobile number: 11 digits, starting 09, nothing else. */
export const mobileNumberPattern = /^09\d{9}$/;
/** An email address: a name, then a domain of labels ending in a letters-only top-level domain. Whether the domain takes mail is checked on the server. */
export const emailPattern = /^[^\s@]{1,64}@(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function withoutEmoji(value: string) {
  return value.replace(emoji, "");
}

export const containsEmoji = (value: string) => withoutEmoji(value) !== value;

/** A name as it's typed: capitals, letters and single spaces only. A space can trail while the next word is typed. */
export const cleanPersonName = (value: string) => withoutEmoji(value).replace(/[^\p{L}\p{M} ]/gu, "").replace(/^ +/, "").replace(/ {2,}/g, " ").toLocaleUpperCase("en-PH");
/** A name as it's saved: the same, without the trailing space. */
export const tidyPersonName = (value: string) => cleanPersonName(value.replace(/\s+/g, " ")).trim();
export const cleanStudentNumber = (value: string) => value.replace(/\D/g, "").slice(0, 10);
export const cleanMobileNumber = (value: string) => value.replace(/\D/g, "").slice(0, 11);
/** An email as it's typed: no spaces, and nothing that isn't text. */
export const cleanEmail = (value: string) => withoutEmoji(value).replace(/\s/g, "");

/** The last part of a field's name: "officers.0.fullName" is "fullName". */
const fieldOf = (name: string) => name.split(/[.\[\]]/).filter(Boolean).at(-1) ?? "";

/** A person's name, by the field's name. Organization and event names aren't. */
export function isPersonNameField(name: string) {
  return /^(?:firstName|lastName|middleName|middleInitial|fullName|givenName|surname|contactPerson|submittedBy|witness\d+Name)$/i.test(fieldOf(name));
}
export const isStudentNumberField = (name: string) => /^(?:studentNumber|studentId)$/i.test(fieldOf(name));
export const isMobileNumberField = (name: string) => /^(?:contactNumber|mobileNumber|mobile|phone|phoneNumber)$/i.test(fieldOf(name));
export const isEmailField = (name: string) => /^(?:email|\w+Email)$/.test(fieldOf(name));

/** What a typed field keeps, by its name. */
export function sanitizeFormInput(value: string, name: string) {
  if (isStudentNumberField(name)) return cleanStudentNumber(value);
  if (isMobileNumberField(name)) return cleanMobileNumber(value);
  if (isPersonNameField(name)) return cleanPersonName(value);
  if (isEmailField(name)) return cleanEmail(value);
  return withoutEmoji(value);
}

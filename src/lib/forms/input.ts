// Match complete emoji sequences without treating ordinary digits, #, or * as emoji.
const emoji = /[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0E\uFE0F\u20E3\u{E0020}-\u{E007F}]/gu;

export const personNamePattern = /^(?:\p{L}\p{M}*)+(?: +(?:\p{L}\p{M}*)+)*$/u;

export function withoutEmoji(value: string) {
  return value.replace(emoji, "");
}

export const containsEmoji = (value: string) => withoutEmoji(value) !== value;

export function isPersonNameField(name: string) {
  const field = name.split(/[.\[\]]/).filter(Boolean).at(-1) ?? "";
  return name === "name" || /^(?:firstName|lastName|middleName|middleInitial|fullName|givenName|surname|contactPerson|submittedBy|witness\d+Name)$/i.test(field);
}

export function sanitizeFormInput(value: string, name: string) {
  const clean = withoutEmoji(value);
  if (/(?:^|[.\[])(?:studentNumber|studentId)\]?$/i.test(name)) return clean.replace(/[^0-9]/g, "").slice(0, 10);
  return isPersonNameField(name) ? clean.replace(/[^\p{L}\p{M} ]/gu, "") : clean;
}

import { z } from "zod";
import { emailPattern, mobileNumberPattern, personNamePattern, studentNumberPattern, tidyPersonName } from "./input";

// The server's side of the input rules (src/lib/forms/input.ts): every schema that takes a name, a
// student number, a mobile number or an email builds it from these. Whether an email's domain takes
// mail is checked after parsing, by emailDomainProblem (src/lib/forms/email-domain.ts).

export const nameMessage = "Use letters only, with single spaces between names.";

/** A person's name, saved in capitals with single spaces. Digits and symbols are refused, not removed. */
export const personName = (required: string, max = 80) =>
  z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(
    z.string().min(1, required).max(max, `Keep it under ${max} characters.`)
      .refine((value) => /^[\p{L}\p{M} ]*$/u.test(value), nameMessage)
      .transform((value) => tidyPersonName(value))
      .pipe(z.string().regex(personNamePattern, nameMessage)),
  );

export const studentNumberMessage = "Use the 10-digit student number, numbers only.";
export const studentNumber = (message = studentNumberMessage) => z.string().trim().regex(studentNumberPattern, message);

export const mobileNumberMessage = "Use an 11-digit mobile number starting with 09, numbers only, like 09171234567.";
/** Exactly 11 digits: dashes and spaces are refused, as anything else is (the form drops them as they're typed). */
export const mobileNumber = (message = mobileNumberMessage) => z.string().trim().regex(mobileNumberPattern, message);
export const optionalMobileNumber = (message = mobileNumberMessage) => z.union([z.literal(""), mobileNumber(message)]);

export const emailMessage = "Enter a valid email address, like name@example.com.";
/** Saved in lower case. */
export const email = (message = emailMessage, max = 254) => z.string().trim().toLowerCase().max(max, message).regex(emailPattern, message);

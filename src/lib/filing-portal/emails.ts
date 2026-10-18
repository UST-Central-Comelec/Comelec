import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, divider, escape, greetingName, link, note, paragraph, quote, shell, siteUrl, status } from "@/lib/email/template";

// The email the filing portal sends when the commission changes an account itself (switch
// "filing-account", under Services → Email → Automatic): its details corrected, its access
// suspended, or restored.

type Person = { firstName: string; email: string };
export type AccountChange = { kind: "updated" } | { kind: "suspended"; reason: string } | { kind: "restored" };

const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);

export function accountChangeEmail(person: Person, change: AccountChange): Email {
  const greeting = `Hi ${greetingName(person.firstName)},`;
  const intro = change.kind === "updated"
    ? "The Comelec corrected the details on your filing portal account. Sign in to see them, and reply to this email if anything is wrong."
    : change.kind === "suspended"
      ? "The Comelec suspended your access to the filing portal. You can’t sign in, and nothing can be filed under your account, until it’s restored. Your party and candidacy stay as they are."
      : "The Comelec restored your access to the filing portal. You can sign in again with your UST Google account.";
  const said = change.kind === "suspended" ? change.reason.trim() : "";
  const url = `${siteUrl()}/filing${change.kind === "suspended" ? "/login" : ""}`;
  return {
    to: person.email,
    subject: change.kind === "updated" ? "Your filing portal details were corrected" : change.kind === "suspended" ? "Your filing portal access is suspended" : "Your filing portal access is restored",
    text: [greeting, intro, said && `The Comelec wrote:\n${said}`, change.kind === "suspended" ? "" : `Open the filing portal: ${url}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: "Filing portal",
      title: change.kind === "updated" ? "Your details were *corrected*" : change.kind === "suspended" ? "Your access is *suspended*" : "Your access is *restored*",
      preheader: intro,
      blocks: [...(change.kind === "restored" ? [status("Restored", "ok")] : []), paragraph(escape(greeting)), paragraph(escape(intro)), ...(said ? [quote(said)] : []), ...(change.kind === "suspended" ? [] : [button("Open the filing portal", url)]), divider(), help],
    }),
  };
}

export const accountChangeSample = () => accountChangeEmail({ firstName: "JUAN", email: "juan.delacruz@ust.edu.ph" }, { kind: "updated" });

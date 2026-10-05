import "server-only";

import { accountAffiliations, accountKinds, accountPositions, chamberRoles, isCommissionerPosition, type AccountSummary } from "@/lib/data/types";
import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, heading, note, paragraph, shell, siteUrl, status, strong, type Details } from "@/lib/email/template";
import { formatExpiry } from "@/lib/portal/expiry";
import { COMET, concernOf, isLocalConcern, relayNote, through, topicFor, unitOf, type Concern } from "./concern";
import type { Actor } from "./notify";

// The emails an account's owner gets when something about their portal account changes: it was
// added, its details were updated, its access was revoked or restored, or it was removed. Each goes
// to that one person (or, for a unit's official account, to that mailbox), and names who did it.
//
// An account in a Local unit is that unit's matter, and its email still leaves from the Central
// Comelec's mailbox, so it says it came through the Central Comelec's COMET (./concern.ts).

/** What these emails read of an account. */
export type Account = Pick<AccountSummary, "name" | "firstName" | "email" | "kind" | "affiliation" | "college" | "position" | "role" | "program" | "studentNumber">;

const TOPIC = "Your portal account";

const concernFor = (account: Pick<Account, "affiliation" | "college">): Concern => concernOf(account.affiliation, account.college);

/** A person is greeted by name; a unit's shared mailbox isn't. */
const greetingOf = (account: Account) => (account.kind === "official" ? "Hi," : `Hi ${greetingName(account.firstName || account.name)},`);

/** "your account", or for a unit's mailbox "this official account". */
const yours = (account: Account) => (account.kind === "official" ? "this official account" : "your account");

/** The account as it stands, as the email lists it. Details the account doesn't have are left out. */
export const accountRows = (account: Account): Details => [
  ["Name", account.name],
  ["UST email", account.email],
  ["Account", account.kind === "official" ? accountKinds.official : ""],
  ["Serves in", accountAffiliations[account.affiliation]],
  ["College or faculty", account.college ?? ""],
  ["Position", account.kind === "official" ? "" : accountPositions[account.position]],
  ["Role", account.role],
  ["Program", account.program ?? ""],
  ["Student number", account.studentNumber ?? ""],
];

type Compared = Account & Pick<AccountSummary, "yearLevel" | "facebookUrl" | "photoUrl" | "chamberRole">;

const changed = (label: string, before: string, after: string): Details => (before === after ? [] : [[label, !before ? `${after} (added)` : !after ? `Removed (was ${before})` : `${after} (was ${before})`]]);

/** What differs between an account before and after a save, as rows: "Role: Chairperson (was Vice Chairperson)". Empty when nothing did. */
export function accountChanges(before: Compared, after: Compared): Details {
  const position = (account: Compared) => (account.kind === "official" ? "" : accountPositions[account.position]);
  // Every Local Chairperson is in the chamber; without one of its two roles, as a member.
  const chamber = (account: Compared) => (account.chamberRole ? chamberRoles[account.chamberRole] : "Member");
  return [
    ...changed("Name", before.name, after.name),
    ...changed("Account", accountKinds[before.kind], accountKinds[after.kind]),
    ...changed("Serves in", accountAffiliations[before.affiliation], accountAffiliations[after.affiliation]),
    ...changed("College or faculty", before.college ?? "", after.college ?? ""),
    ...changed("Position", position(before), position(after)),
    ...changed("Role", before.role, after.role),
    ...changed("Year level", before.yearLevel ?? "", after.yearLevel ?? ""),
    ...changed("Program", before.program ?? "", after.program ?? ""),
    ...changed("Student number", before.studentNumber ?? "", after.studentNumber ?? ""),
    ...changed("Facebook", before.facebookUrl ?? "", after.facebookUrl ?? ""),
    ...(before.photoUrl === after.photoUrl ? [] : ([["Photo", !before.photoUrl ? "Added" : !after.photoUrl ? "Removed" : "Replaced"]] satisfies Details)),
    ...changed("Chamber of Chairpersons", chamber(before), chamber(after)),
  ];
}

/** Whether a save moved the account to another unit or position: what it may open in the portal follows those. */
export const changesAccess = (before: Compared, after: Compared) => before.kind !== after.kind || before.affiliation !== after.affiliation || before.position !== after.position || (after.affiliation === "local" && before.college !== after.college);

const loginUrl = () => `${siteUrl()}/portal/login`;

const unexpected = "If you didn’t expect this, reply to this email or tell your Executive Board.";

/** What the emails end with: for a Local unit's account, why the Central Comelec is writing. */
function closing(account: Account) {
  const relay = relayNote(concernFor(account), yours(account));
  return { blocks: relay ? [divider(), note(escape(relay))] : [], text: relay };
}

/** An account was added by hand under Accounts (one approved from Request access gets the approval email instead). */
export function accountAddedEmail(account: Account, by: Actor): Email {
  const concern = concernFor(account);
  const end = closing(account);
  const unit = account.affiliation === "osa" ? accountAffiliations.osa : unitOf(concern);
  const intro = account.kind === "official" ? `${by.name} (${by.role}) added this mailbox to the Commission Portal as the ${unit}’s official account.` : `${by.name} (${by.role}) added an account for you in the Commission Portal, as a member of the ${unit}.`;
  const signIn = "Your account has been added. Your email is not verified yet: sign in to the portal for the first time with your @ust.edu.ph Google account and complete Google verification to verify your email and access. What you can open follows your unit and position.";
  const rows = accountRows(account);

  return {
    to: account.email,
    subject: through("You’ve been added to the Commission Portal", concern),
    text: [greetingOf(account), intro, signIn, loginUrl(), "Your account", detailsText(rows), "If a detail is wrong, tell whoever added you, or your Executive Board, so they can correct it under Accounts.", end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: "Welcome to the *portal*",
      preheader: "You’ve been given access to the Commission Portal. Sign in with Google.",
      blocks: [
        status("Access granted", "ok"),
        paragraph(escape(greetingOf(account))),
        paragraph(escape(intro)),
        paragraph(escape(signIn)),
        button("Verify access to the portal", loginUrl()),
        heading("Your account"),
        details(rows),
        note("If a detail is wrong, tell whoever added you, or your Executive Board, so they can correct it under Accounts."),
        ...end.blocks,
      ],
    }),
    replyTo: { name: by.name, address: by.email },
  };
}

/**
 * An account's details were changed. `changes` is what differs (accountChanges), `own` whether the
 * owner changed it themselves, and `access` whether its unit or position moved, and so what it opens.
 */
export function accountUpdatedEmail(account: Account, changes: Details, by: Actor, { own = false, access = false }: { own?: boolean; access?: boolean } = {}): Email {
  const concern = concernFor(account);
  const end = closing(account);
  const url = `${siteUrl()}/portal/account`;
  const intro = own ? `You updated ${yours(account)}’s details in the Commission Portal. Here’s what changed:` : `${by.name} (${by.role}) updated ${yours(account)} in the Commission Portal. Here’s what changed:`;
  const opens = "What you can open in the portal follows your unit and position, so that has changed with them. You’ll see it the next time you open the portal.";
  const rows = accountRows(account);

  return {
    to: account.email,
    subject: through(access ? "Your Commission Portal account and access were updated" : "Your Commission Portal account was updated", concern),
    text: [greetingOf(account), intro, detailsText(changes), access && opens, "Your account now", detailsText(rows), `Your account in the portal: ${url}`, unexpected, end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: access ? "Your account and access were *updated*" : "Your account was *updated*",
      preheader: `${changes.length === 1 ? "One detail" : `${changes.length} details`} of your portal account changed.`,
      blocks: [
        paragraph(escape(greetingOf(account))),
        paragraph(escape(intro)),
        details(changes),
        ...(access ? [paragraph(escape(opens))] : []),
        heading("Your account now"),
        details(rows),
        button("Open your account", url),
        note(escape(unexpected)),
        ...end.blocks,
      ],
    }),
    ...(own ? {} : { replyTo: { name: by.name, address: by.email } }),
  };
}

/** Access was revoked or restored under Accounts. */
export function accountAccessEmail(account: Account, active: boolean, by: Actor): Email {
  const concern = concernFor(account);
  const end = closing(account);
  const listed = account.kind === "personal" && isCommissionerPosition(account.position);
  const intro = active
    ? `${by.name} (${by.role}) restored ${yours(account)}’s access to the Commission Portal. You can sign in again with Google using this UST account${listed ? ", and you’re back in the Directory" : ""}.`
    : `${by.name} (${by.role}) revoked ${yours(account)}’s access to the Commission Portal. You can no longer sign in${listed ? ", and you’re no longer listed in the Directory" : ""}.`;
  const next = active ? "" : "If you think this is a mistake, contact your Executive Board, or reply to this email.";
  const rows: Details = [["Account", account.name], ["UST email", account.email], ["Access", active ? "Restored" : "Revoked"]];

  return {
    to: account.email,
    subject: through(active ? "Your Commission Portal access was restored" : "Your Commission Portal access was revoked", concern),
    text: [greetingOf(account), intro, next, detailsText(rows), active && loginUrl(), end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: active ? "Your access was *restored*" : "Your access was *revoked*",
      preheader: active ? "You can sign in to the Commission Portal again." : "You can no longer sign in to the Commission Portal.",
      blocks: [
        ...(active ? [status("Access restored", "ok")] : []),
        paragraph(escape(greetingOf(account))),
        paragraph(escape(intro)),
        ...(next ? [paragraph(escape(next))] : []),
        details(rows),
        ...(active ? [button("Verify access to the portal", loginUrl())] : []),
        ...end.blocks,
      ],
    }),
    replyTo: { name: by.name, address: by.email },
  };
}

/** Access ended by itself: the date set under Accounts → Expiration passed. */
export function accountExpiredEmail(account: Account, expiresOn: string): Email {
  const concern = concernFor(account);
  const end = closing(account);
  const intro = `Commissioners’ access to the Commission Portal ended on ${formatExpiry(expiresOn)}, the date the Central Executive Board set for the end of the term, so your account’s access has been revoked. You can no longer sign in, and you’re no longer listed in the Directory.`;
  const next = "If you’re staying on with the commission, your Executive Board can restore your access under Accounts.";
  const rows: Details = [["Account", account.name], ["UST email", account.email], ["Access ended", formatExpiry(expiresOn)]];

  return {
    to: account.email,
    subject: isLocalConcern(concern) ? `Notice through the ${COMET}: your Commission Portal access has ended` : "Your Commission Portal access has ended",
    text: [greetingOf(account), intro, next, detailsText(rows), end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: "Your access has *ended*",
      preheader: `Commissioners’ portal access ended on ${formatExpiry(expiresOn)}.`,
      blocks: [paragraph(escape(greetingOf(account))), paragraph(escape(intro)), paragraph(escape(next)), details(rows), ...end.blocks],
    }),
  };
}

/** The account was deleted under Accounts. */
export function accountRemovedEmail(account: Account, by: Actor): Email {
  const concern = concernFor(account);
  const end = closing(account);
  const listed = account.kind === "personal" && isCommissionerPosition(account.position);
  const intro = `${by.name} (${by.role}) removed ${yours(account)} from the Commission Portal. You can no longer sign in${listed ? ", and you’re out of the Directory" : ""}.`;
  const next = listed ? "If you still serve in the commission, you can ask for access again from the portal’s sign-in page (Request access), or contact your Executive Board." : "If you think this is a mistake, contact the Central Comelec’s Executive Board, or reply to this email.";

  return {
    to: account.email,
    subject: through("Your Commission Portal account was removed", concern),
    text: [greetingOf(account), intro, next, end.text, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: topicFor(TOPIC, concern),
      title: "Your account was *removed*",
      preheader: "You can no longer sign in to the Commission Portal.",
      blocks: [paragraph(escape(greetingOf(account))), paragraph(`${strong(escape(by.name))} (${escape(by.role)}) removed ${escape(yours(account))} from the Commission Portal. You can no longer sign in${listed ? ", and you’re out of the Directory" : ""}.`), paragraph(escape(next)), ...end.blocks],
    }),
    replyTo: { name: by.name, address: by.email },
  };
}

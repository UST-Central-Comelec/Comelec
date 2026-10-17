import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { candidacyOfAccount } from "@/lib/candidacy/store";
import type { Candidacy } from "@/lib/candidacy/types";
import { getParty, membershipOfAccount } from "@/lib/party-portal/store";
import type { Party, PartyMember } from "@/lib/party-portal/types";
import { getAccount } from "./accounts";
import { decodeFilingSession, encodeFilingSession, FILING_SESSION_COOKIE, filingSessionCookieOptions, filingTimeout } from "./session-token";
import type { PublicAccount } from "./types";

// Who's signed in to the filing portal. The cookie only says who signed in (./session-token.ts);
// the account, its party membership and its candidacy are read from the database on every
// request, so a declined request or a removed member is out on their next click.

export type Membership = { member: PartyMember; party: Party };
export type FilingAccount = { account: PublicAccount; membership: Membership | null; candidacy: Candidacy | null };

/** Starts a session for `account`: after signing in with Google, or making the account. */
export async function startFilingSession(account: Pick<PublicAccount, "id" | "email">) {
  const now = Date.now();
  (await cookies()).set(FILING_SESSION_COOKIE, await encodeFilingSession({ accountId: account.id, email: account.email, startedAt: now, lastActiveAt: now }), filingSessionCookieOptions);
}

export async function endFilingSession() {
  (await cookies()).delete({ name: FILING_SESSION_COOKIE, path: filingSessionCookieOptions.path });
}

/** The signed-in account, with its party membership (asked to join counts) and its candidacy. */
export const getFilingAccount = cache(async (): Promise<FilingAccount | null> => {
  await connection();
  const session = await decodeFilingSession((await cookies()).get(FILING_SESSION_COOKIE)?.value);
  if (!session || filingTimeout(session)) return null;
  const account = await getAccount(session.accountId);
  if (!account || account.email !== session.email.toLowerCase()) return null;
  const [member, candidacy] = await Promise.all([membershipOfAccount(account.id), candidacyOfAccount(account.id)]);
  const party = member ? await getParty(member.partyId) : null;
  return { account, membership: member && party ? { member, party } : null, candidacy };
});

/** Use in every filing portal page and action: the proxy's check alone isn't a security boundary. */
export async function requireFilingAccount() {
  const account = await getFilingAccount();
  if (!account) redirect("/filing/login");
  return account;
}

/** For the party's files and members: a member of its group, not someone still asking to join. */
export async function requirePartyMember(): Promise<FilingAccount & Membership> {
  const account = await requireFilingAccount();
  if (!account.membership || account.membership.member.status !== "active") redirect("/filing");
  return { ...account, ...account.membership };
}

/** For the candidacy's pages and actions: the account's own filing. */
export async function requireCandidacy(): Promise<FilingAccount & { candidacy: Candidacy }> {
  const account = await requireFilingAccount();
  if (!account.candidacy) redirect("/filing");
  return { ...account, candidacy: account.candidacy };
}

export const isContactPerson = ({ member, party }: Membership) => member.role === "contact" && party.contactMemberId === member.id;

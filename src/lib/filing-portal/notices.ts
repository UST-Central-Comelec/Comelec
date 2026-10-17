import "server-only";

import { listNotices } from "@/lib/party-portal/store";
import { countAccountNotices, listAccountNotices } from "./accounts";
import type { FilingAccount } from "./session";
import type { Notice } from "./types";

/** An account's notifications, newest first: its own (its candidacy's) and its party's, once it's a member. */
export async function noticesFor({ account, membership }: FilingAccount, limit = 100): Promise<Notice[]> {
  const member = membership?.member.status === "active" ? membership.member : null;
  const [own, party] = await Promise.all([listAccountNotices(account.id, limit), member ? listNotices(member, limit) : Promise.resolve([])]);
  return [...own, ...party].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export { countAccountNotices };

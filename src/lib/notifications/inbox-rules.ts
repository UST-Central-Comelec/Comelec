import type { AccountSummary } from "@/lib/data/types";

type Sender = Pick<AccountSummary, "kind" | "affiliation" | "college" | "position"> & { readOnly: boolean; builtIn: boolean };
export type AnnouncementAudience = "unit" | "all";

export function canAnnounce(sender: Sender) {
  return !sender.readOnly && (sender.kind === "official" || sender.builtIn || (sender.affiliation === "central" && sender.position === "executive-board"));
}

export function canBroadcast(sender: Sender) {
  return canAnnounce(sender) && sender.affiliation === "central";
}

/** Snapshot recipients by membership, so switching accounts never crosses unit boundaries. */
export function announcementRecipients(sender: Sender, audience: AnnouncementAudience, accounts: readonly AccountSummary[]) {
  if (!canAnnounce(sender) || (audience === "all" && !canBroadcast(sender))) return [];
  if (sender.affiliation === "local" && !sender.college) return [];
  return accounts.filter((account) => account.active && account.affiliation !== "osa"
    && (account.kind === "official" || ["executive-board", "executive-associate", "deputy"].includes(account.position))
    && (audience === "all" || (account.affiliation === sender.affiliation && (sender.affiliation !== "local" || account.college === sender.college))))
    .map((account) => account.id);
}

export type InboxMessage = {
  id: string;
  kind: "announcement" | "activity";
  title: string;
  body: string;
  senderName: string;
  audienceLabel: string;
  createdAt: string;
  readAt: string | null;
};

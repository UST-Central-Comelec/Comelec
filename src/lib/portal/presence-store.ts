import "server-only";
import { unitAbbreviations } from "@/lib/applications/options";

import { describeRole, positionName, toSummary } from "@/lib/data/accounts";
import { builtInUser, canSeeCollege, isBuiltInEmail, isLocal, type PortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { accountAffiliations, type PortalAccount } from "@/lib/data/types";
import { signature } from "@/lib/security/signed-token";
import { createAdminClient } from "@/lib/supabase/server";
import { ONLINE_WINDOW_MS, RECENT_WINDOW_MS, presenceUnit, type PresencePerson, type PresenceProfile, type RealtimeInfo } from "./presence";

type PresenceRow = { email: string; account_id: string; name: string; role: string; college: string | null; avatar_url: string | null; last_seen_at: string };

const normal = (email: string) => email.trim().toLowerCase();

/** An account’s id in the presence channel: stable, and says nothing about who they are. */
export const presenceId = async (accountId: string) => (await signature("presence-account-id", accountId)).slice(0, 22);

/** An account’s own inbox channel. Only they are told its name. */
export const inboxTopic = async (accountId: string) => `inbox-${await signature("presence-account-inbox", accountId)}`;

/** The channel everyone online joins, so each sees the others arrive and leave the moment they do. */
export const lobbyTopic = async () => `lobby-${(await signature("presence-lobby", "portal")).slice(0, 22)}`;

const roleLine = (row: Pick<PresenceRow, "role" | "college">) => (row.college ? `${row.role} · ${row.college}` : row.role);

function currentAccount(row: Pick<PresenceRow, "account_id" | "email">, accounts: PortalAccount[]) {
  const record = accounts.find((account) => account.id === row.account_id && normal(account.email) === normal(row.email));
  const account = record ? toSummary(record) : null;
  if (isBuiltInEmail(row.email) && (row.account_id === "built-in" || account?.affiliation === "central")) return builtInUser(undefined, account);
  return account?.active ? account : null;
}

/** Derive recipients from current active memberships; a browser cannot choose group members. */
export async function unitRecipients(user: PortalUser) {
  const { data, error } = await createAdminClient().from("portal_presence")
    .select("email, account_id")
    .gte("last_seen_at", new Date(Date.now() - ONLINE_WINDOW_MS).toISOString());
  if (error) throw new Error("Couldn’t load the unit group.");
  const accounts = await store.list("accounts");
  const unit = presenceUnit(user);
  return [...new Set([user.id, ...(data ?? []).filter((row) => {
    const account = currentAccount(row, accounts);
    return account && presenceUnit(account).key === unit.key;
  }).map((row) => row.account_id)])];
}

/** Only recent, active accounts in the viewer's college scope may expose profile details. */
export async function presenceProfile(viewer: PortalUser, accountId: string): Promise<PresenceProfile | null> {
  // Both lookups key on the same id, so run them together rather than one after the other.
  const [{ data, error }, record] = await Promise.all([
    createAdminClient().from("portal_presence")
      .select("account_id, email, avatar_url")
      .eq("account_id", accountId)
      .gte("last_seen_at", new Date(Date.now() - RECENT_WINDOW_MS).toISOString())
      .maybeSingle(),
    store.get("accounts", accountId),
  ]);
  if (error) throw new Error("Couldn’t load the profile.");
  if (!data) return null;
  const account = record ? toSummary(record) : null;
  const builtIn = isBuiltInEmail(data.email) && (accountId === "built-in" || account?.affiliation === "central");
  if (!builtIn && (!account?.active || normal(account.email) !== normal(data.email))) return null;
  const profile = builtIn ? builtInUser(undefined, account) : account;
  if (!profile || (normal(viewer.email) !== normal(profile.email) && !canSeeCollege(viewer, profile.college ?? ""))) return null;
  return {
    name: profile.name,
    avatarUrl: data.avatar_url ?? null,
    college: profile.affiliation === "central" ? "University of Santo Tomas" : profile.college,
    position: positionName(profile),
    role: profile.kind === "official" ? "Official Account" : profile.role || "Not assigned",
    unit: accountAffiliations[profile.affiliation],
    email: normal(profile.email),
  };
}

/**
 * Marks `user` as here now and returns everyone seen in the last 24 hours, most recent first: one
 * small write and one read per check-in. Their details are copied from the account they're using,
 * so Central and Local memberships keep independent entries and last-seen timestamps.
 */
export async function checkIn(user: PortalUser): Promise<{ people: PresencePerson[]; realtime: RealtimeInfo }> {
  const db = createAdminClient();
  const email = normal(user.email);
  const now = Date.now();
  const [lobby, inbox, me] = await Promise.all([lobbyTopic(), inboxTopic(user.id), presenceId(user.id)]);
  const { error } = await db.from("portal_presence").upsert({
    email,
    account_id: user.id,
    // What the Realtime policies check before letting this person into a channel.
    lobby_topic: lobby,
    inbox_topic: inbox,
    name: user.name,
    role: describeRole(user),
    college: isLocal(user) ? user.college : null,
    avatar_url: user.avatarUrl ?? null,
    last_seen_at: new Date(now).toISOString(),
  }, { onConflict: "account_id" });
  if (error) throw new Error(`Couldn’t record who’s online: ${error.message}`);

  const { data, error: readError } = await db.from("portal_presence")
    .select("email, account_id, name, role, college, avatar_url, last_seen_at")
    .gte("last_seen_at", new Date(now - RECENT_WINDOW_MS).toISOString())
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (readError) throw new Error(`Couldn’t load who’s online: ${readError.message}`);

  const accounts = await store.list("accounts");
  const rows = (data as PresenceRow[]).flatMap((row) => {
    const account = currentAccount(row, accounts);
    return account ? [{ ...row, name: account.name, role: describeRole(account), college: isLocal(account) ? account.college : null, unit: presenceUnit(account), faculty: account.affiliation === "central" ? "University of Santo Tomas" : account.college }] : [];
  });
  const people = await Promise.all(rows.map(async (row) => ({
    email: row.email,
    accountId: row.account_id,
    id: await presenceId(row.account_id),
    name: row.name,
    role: roleLine(row),
    avatarUrl: row.avatar_url,
    lastSeenAt: row.last_seen_at,
    online: now - Date.parse(row.last_seen_at) < ONLINE_WINDOW_MS,
    you: row.account_id === user.id,
    unit: row.unit,
    college: row.faculty,
    collegeAbbreviation: unitAbbreviations[row.faculty ?? ""] ?? "",
  })));
  return { people, realtime: { lobby, inbox, me, email, accountId: user.id, unit: presenceUnit(user) } };
}

/** Who someone is, as their messages are signed, if they've had the portal open in the last few minutes. */
export async function findOnline(accountId: string) {
  const { data, error } = await createAdminClient().from("portal_presence")
    .select("email, account_id, name, role, college, avatar_url, last_seen_at")
    .eq("account_id", accountId)
    .gte("last_seen_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .maybeSingle();
  if (error) throw new Error(`Couldn’t look up who’s online: ${error.message}`);
  if (!data) return null;
  const account = await store.get("accounts", data.account_id);
  const builtIn = isBuiltInEmail(data.email) && (accountId === "built-in" || (account && toSummary(account).affiliation === "central"));
  if (!builtIn && (!account?.active || normal(account.email) !== normal(data.email))) return null;
  return data as PresenceRow | null;
}

/** `user` as the sender of a relayed message. */
export async function senderOf(user: PortalUser) {
  const email = normal(user.email);
  const role = describeRole(user);
  return { email, accountId: user.id, id: await presenceId(user.id), name: user.name, role: isLocal(user) && user.college ? `${role} · ${user.college}` : role, avatarUrl: user.avatarUrl ?? null };
}

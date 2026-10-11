import "server-only";
import { canOpen, type PortalUser } from "@/lib/auth/session";
import { getUnseenApplicantCount } from "@/lib/applications/views";
import { getInboxUnreadCount } from "@/lib/notifications/inbox-store";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { approverRoleOf, canEditCodes, codes } from "@/lib/codes/options";
import { listRevisions } from "@/lib/codes/store";
import { getEvents } from "@/lib/events/queries";
import { isRequestKind } from "@/lib/events/options";
import { canManageEvent } from "@/lib/events/access";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { canDecideRequest } from "./account-scope";
import type { TabKey } from "./access";
import type { AttentionCounts } from "./attention-types";

/** Counts are scoped to the signed-in account; unavailable queues do not erase other badges. */
export async function getPortalAttention(user: PortalUser): Promise<AttentionCounts> {
  const queues: Array<Promise<AttentionCounts>> = [];
  const add = (tab: TabKey, load: () => Promise<number>) => {
    if (canOpen(user, tab)) queues.push(load().then(count => ({ [tab]: count })));
  };
  add("recruitment/applications", () => getUnseenApplicantCount(user));
  add("apps/inbox", () => getInboxUnreadCount(user));
  if (!user.readOnly) {
    add("accounts", async () => (await listPendingAccessRequests()).filter(request => canDecideRequest(user, request)).length);
    add("polpar/registrations", async () => {
      if (!isSupabaseConfigured() || (user.affiliation === "local" && !user.college)) return 0;
      let query = createAdminClient().from("party_registrations").select("id", { count: "exact", head: true }).is("reviewed_at", null);
      if (user.affiliation === "local") query = query.eq("college", user.college!);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return count ?? 0;
    });
    const office = approverRoleOf(user);
    if (office) add("documents/approval", async () => (await listRevisions({ status: "pending" })).filter(revision => !revision.approvals[office]).length);
    if (canEditCodes(user)) {
      const open = Object.values(codes).filter(code => canOpen(user, code.tab));
      if (open.length) queues.push(listRevisions({ status: "draft" }).then(revisions => Object.fromEntries(open.map(code => [code.tab, revisions.filter(revision => codes[revision.code].tab === code.tab && revision.returned).length]))));
    }
    add("events", async () => {
      const manageable = (await getEvents()).filter(event => canManageEvent(user, event));
      let count = manageable.filter(event => event.changeRequest).length;
      if (!isSupabaseConfigured() || !manageable.length) return count;
      // Count registrants waiting for a request decision, once each, across manageable events.
      const ids = manageable.map(event => event.id);
      for (let start = 0; start < ids.length; start += 100) {
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await createAdminClient().from("event_registrations").select("requests")
            .in("event_id", ids.slice(start, start + 100)).order("id").range(offset, offset + 999);
          if (error) throw new Error(error.message);
          count += (data ?? []).filter(row => row.requests && Object.entries(row.requests).some(([kind, entry]) =>
            isRequestKind(kind) && entry && typeof entry === "object" && "status" in entry && entry.status === "pending")).length;
          if ((data?.length ?? 0) < 1000) break;
        }
      }
      return count;
    });
  }
  const results = await Promise.allSettled(queues);
  return Object.assign({}, ...results.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
}

import "server-only";
import { canOpen, type PortalUser } from "@/lib/auth/session";
import { getUnseenApplicantCount } from "@/lib/applications/views";
import { getInboxUnreadCount } from "@/lib/notifications/inbox-store";
import { listPendingAccessRequests } from "@/lib/access-requests/admin";
import { approverRoleOf, canEditCodes, codes } from "@/lib/codes/options";
import { listRevisions } from "@/lib/codes/store";
import { getEvents } from "@/lib/events/queries";
import { requestKinds } from "@/lib/events/options";
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
    // The filing portal's queues: requests waiting for an answer, petitions waiting to be docketed, campaign items to review.
    const unitCount = async (table: string, status: string, scope: "college" | "candidacy.college" = "college") => {
      if (!isSupabaseConfigured() || (user.affiliation === "local" && !user.college)) return 0;
      let query = createAdminClient().from(table).select(scope === "college" ? "id" : "id, candidacy:candidacies!inner(college)", { count: "exact", head: true }).eq("status", status);
      if (user.affiliation === "local") query = query.eq(scope, user.college!);
      const { count, error } = await query;
      if (error) throw new Error(error.message);
      return count ?? 0;
    };
    add("request", () => unitCount("filing_requests", "requested"));
    add("petitions/case-docket", () => unitCount("petitions", "filed"));
    add("candidacy/campaign", async () => (await Promise.all([unitCount("campaign_materials", "submitted", "candidacy.college"), unitCount("campaign_activities", "submitted", "candidacy.college")])).reduce((a, b) => a + b, 0));
    const office = approverRoleOf(user);
    if (office) add("documents/approval", async () => (await listRevisions({ status: "pending" })).filter(revision => !revision.approvals[office]).length);
    if (canEditCodes(user)) {
      const open = Object.values(codes).filter(code => canOpen(user, code.tab));
      if (open.length) queues.push(listRevisions({ status: "draft" }).then(revisions => Object.fromEntries(open.map(code => [code.tab, revisions.filter(revision => codes[revision.code].tab === code.tab && revision.returned).length]))));
    }
    add("events", async () => {
      // The events and the database's per-event count of registrants waiting for a request decision, together.
      const [events, pending] = await Promise.all([
        getEvents(),
        isSupabaseConfigured() ? createAdminClient().rpc("event_pending_request_counts", { p_kinds: Object.keys(requestKinds) }) : null,
      ]);
      if (pending?.error) throw new Error(pending.error.message);
      const rows = (pending?.data ?? []) as Array<{ event_id: string; pending: number }>;
      const waiting = new Map(rows.map(row => [row.event_id, row.pending]));
      const manageable = events.filter(event => canManageEvent(user, event));
      return manageable.reduce((count, event) => count + (event.changeRequest ? 1 : 0) + (waiting.get(event.id) ?? 0), 0);
    });
  }
  const results = await Promise.allSettled(queues);
  return Object.assign({}, ...results.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { deploymentValuesSchema, type PendingDeployment, type DeploymentValues } from "./deployment";

type Row = { settings: DeploymentValues; version: string; apply_at: string; applied_at: string | null; error: string | null };
const pending = (row: Row): PendingDeployment => ({ values: deploymentValuesSchema.parse(row.settings), version: row.version, applyAt: row.apply_at, error: row.error });
const problem = "Couldn’t schedule deployment changes. Apply the event_deployment_grace migration and try again.";

export async function getPendingDeployment(eventId: string): Promise<PendingDeployment | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from("event_deployment_changes").select("settings,version,apply_at,applied_at,error").eq("event_id", eventId).is("applied_at", null).maybeSingle();
  if (error) throw new Error(problem);
  return data ? pending(data as Row) : null;
}

export async function queueDeployment(eventId: string, values: DeploymentValues, seed: { evaluationQuestions: unknown; evaluationSteps: unknown }, author: string, clientId: string, revision: number): Promise<PendingDeployment> {
  const { data, error } = await createAdminClient().rpc("queue_event_deployment", { p_event_id: eventId, p_values: { ...values, ...seed }, p_author: author, p_client_id: clientId, p_revision: revision });
  if (error || !data) throw new Error(problem);
  return pending((Array.isArray(data) ? data[0] : data) as Row);
}

export async function cancelDeployment(eventId: string, version: string): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("cancel_event_deployment", { p_event_id: eventId, p_version: version });
  if (error) throw new Error("Couldn’t discard the scheduled changes. Try again.");
  return data === true;
}

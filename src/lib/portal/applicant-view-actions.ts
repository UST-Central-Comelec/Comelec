"use server";
import { requireAccess } from "@/lib/auth/session";
import { markApplicantsViewed } from "@/lib/applications/views";

export async function seeApplicants(ids: string[]): Promise<boolean> {
  const user = await requireAccess("recruitment/applications");
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) return false;
  if (!ids.length) return true;
  try { await markApplicantsViewed(user, [...new Set(ids)]); return true; }
  catch { return false; }
}

"use server";

import { revalidatePath } from "next/cache";
import { colleges } from "@/lib/applications/options";
import { requireAccess } from "@/lib/auth/session";
import { editsDatabase } from "@/lib/reference/data";
import { ensureReferenceData } from "@/lib/reference/store";
import { electiveIdFor, electivePositionsSchema, type ElectivePosition } from "./positions";
import { saveElectivePositions } from "./positions-store";

// Administrative → Database → Elective positions: saving a unit's list. Like the rest of the
// Database, only official accounts change it, and a Local one only its own unit's.

export type SavePositionsResult = { positions: ElectivePosition[]; stamp: string } | { error: string; fieldErrors?: Record<string, string> };

export async function saveElectivePositionsAction(unit: string, stamp: string | null, value: unknown): Promise<SavePositionsResult> {
  await ensureReferenceData();
  const user = await requireAccess("database");
  if (!editsDatabase(user)) return { error: "Only official accounts can change the Database." };
  if (unit !== "" && !colleges.includes(unit)) return { error: "That unit isn’t in the Database. Reload the page and try again." };
  if (user.affiliation === "local" && user.college !== unit) return { error: "Your official account can only change its own unit’s lists." };
  const parsed = electivePositionsSchema.safeParse(value);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Check the highlighted positions.", fieldErrors };
  }
  // New rows get ids from their names, so a rename later keeps the same position.
  const taken = new Set(parsed.data.filter((item) => !item.id.startsWith("new-")).map((item) => item.id));
  const positions = parsed.data.map((item) => {
    if (!item.id.startsWith("new-")) return item;
    const id = electiveIdFor(item.name, taken);
    taken.add(id);
    return { id, name: item.name };
  });
  const result = await saveElectivePositions(unit, positions, stamp, user.email);
  if ("conflict" in result) return { error: "Someone saved this list while you were editing. Reload the page to see their changes, then make yours again." };
  revalidatePath("/portal/database/elective-positions");
  revalidatePath("/candidacy");
  return { positions, stamp: result.stamp };
}


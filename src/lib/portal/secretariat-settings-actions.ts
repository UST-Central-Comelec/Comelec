"use server";

import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth/session";
import { secretariatSettingsSchema, type SecretariatSettings } from "@/lib/letters/settings";
import { getSecretariatSettings, writeSecretariatSettings } from "@/lib/letters/settings-store";

export type SettingsSaveResult =
  | { settings: SecretariatSettings; updatedAt: string | null; error?: never; fieldErrors?: never }
  | { settings?: never; updatedAt?: never; error: string; fieldErrors?: Record<string, string> };

const blockedNoun = { letterType: ["letter type", "letter"], minuteType: ["minutes type", "meeting minutes record"], status: ["status", "letter or meeting minutes record"] } as const;

/** `expected` is when the settings the editor opened were saved, so a save can't silently undo someone else's. */
export async function saveSecretariatSettings(expected: string | null, value: unknown): Promise<SettingsSaveResult> {
  const user = await requireEditor("secretariat/settings");
  if (expected !== null && typeof expected !== "string") return { error: "Reload the page and try again." };
  const parsed = secretariatSettingsSchema.safeParse(value);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    return { error: "Check the highlighted settings.", fieldErrors };
  }
  try {
    const outcome = await writeSecretariatSettings(parsed.data, expected, user.email);
    if ("conflict" in outcome) return { error: "Someone else saved these settings while you were editing. Reload the page to see their changes, then make yours again." };
    if ("blocked" in outcome) {
      const reasons = outcome.blocked.map(({ kind, name, count }) => {
        const [noun, record] = blockedNoun[kind as keyof typeof blockedNoun] ?? ["item", "record"];
        return `The ${noun} “${name}” is still used by ${count} ${record}${count === 1 ? "" : "s"}.`;
      });
      return { error: `${reasons.join(" ")} Change those records first, or rename the ${outcome.blocked.length === 1 ? "item" : "items"} instead of removing ${outcome.blocked.length === 1 ? "it" : "them"}.` };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the settings. Try again." };
  }
  revalidatePath("/portal/secretariat", "layout");
  const saved = await getSecretariatSettings();
  return { settings: saved.settings, updatedAt: saved.updatedAt };
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BUILT_IN_ID, requireEditor, requirePortalUser } from "@/lib/auth/session";
import { toSummary } from "@/lib/data/accounts";
import { describeAffiliation } from "@/lib/data/types";
import { store } from "@/lib/data/store";
import { announcementRecipients, canAnnounce, canBroadcast } from "@/lib/notifications/inbox-rules";
import { markMessageRead, publishMessage } from "@/lib/notifications/inbox-store";
import { text, toFormState, type FormState } from "./form";

const schema = z.object({
  title: z.string().trim().min(3, "Add a title of at least 3 characters.").max(160),
  body: z.string().trim().min(1, "Write your announcement.").max(20000),
  audience: z.enum(["unit", "all"]),
});

export async function sendAnnouncement(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor("apps/inbox");
  if (!canAnnounce(user)) return { error: "Only official accounts and the Central Executive Board can send announcements." };
  const parsed = schema.safeParse({ title: text(formData, "title"), body: text(formData, "body"), audience: text(formData, "audience") });
  if (!parsed.success) return toFormState(parsed.error);
  if (parsed.data.audience === "all" && !canBroadcast(user)) return { error: "Only Central Comelec can send to all units and commissioners." };
  try {
    const accounts = (await store.list("accounts")).map(toSummary);
    const ids = announcementRecipients(user, parsed.data.audience, accounts);
    const builtIn = process.env.PORTAL_EXECUTIVE_EMAIL?.trim().toLowerCase();
    if (builtIn && (parsed.data.audience === "all" || user.affiliation === "central") && !accounts.some((account) => account.active && account.affiliation === "central" && account.email.trim().toLowerCase() === builtIn)) ids.push(BUILT_IN_ID);
    await publishMessage({ kind: "announcement", title: parsed.data.title, body: parsed.data.body,
      senderName: describeAffiliation(user.affiliation, user.college),
      audienceLabel: parsed.data.audience === "all" ? "All units and commissioners" : `${describeAffiliation(user.affiliation, user.college)} commissioners`,
    }, ids);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t send the announcement. Try again." };
  }
  revalidatePath("/portal", "layout");
  redirect("/portal/apps/inbox?notice=sent");
}

/** Reading one's notifications is allowed for viewer accounts too. */
export async function readNotification(id: string): Promise<{ error?: string }> {
  const user = await requirePortalUser();
  if (!z.uuid().safeParse(id).success) return { error: "This notification is unavailable." };
  try {
    await markMessageRead(user, id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t mark the notification as read." };
  }
  revalidatePath("/portal", "layout");
  return {};
}

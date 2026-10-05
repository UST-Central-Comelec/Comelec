"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { fromManilaInput } from "@/lib/applications/period";
import { text, type FormState } from "@/lib/portal/form";
import { requirements } from "./content";
import { getPartyRegistration } from "./store";

export async function savePartyReview(id: string, _state: FormState, form: FormData): Promise<FormState & { saved?: boolean }> {
  const user = await requireEditor("polpar/registrations");
  await getPartyRegistration(id);
  const parsed = z.object({ receivedBy: z.string().trim().max(250), certifiedBy: z.string().trim().max(250), remarks: z.string().trim().max(5000) }).safeParse({ receivedBy: text(form, "receivedBy"), certifiedBy: text(form, "certifiedBy"), remarks: text(form, "remarks") });
  if (!parsed.success) return { error: "Use at most 250 characters for names and 5,000 for remarks." };
  const received = text(form, "receivedAt");
  const receivedAt = received ? fromManilaInput(received) : null;
  if (received && !receivedAt) return { error: "Enter a valid date and time received." };
  const checked = form.getAll("checked").filter((value): value is string => typeof value === "string" && requirements.some((item) => item.id === value));
  const { error } = await createAdminClient().from("party_registrations").update({ review: { ...parsed.data, receivedAt, checked }, reviewed_by: user.email, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) return { error: "The checklist could not be saved. Please try again." };
  revalidatePath(`/portal/polpar/registrations/${id}`);
  return { saved: true };
}

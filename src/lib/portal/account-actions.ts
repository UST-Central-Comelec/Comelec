"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BUILT_IN_ID, isAllowedEmail, isBuiltInEmail, requireExecutive } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { accountRoles, type AccountRole } from "@/lib/data/types";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { text, toFormState, type FormState } from "./form";

const role = z.enum(Object.keys(accountRoles) as [AccountRole, ...AccountRole[]], "Pick a role.");
const name = z.string().trim().min(2, "Add their name.").max(120);
const email = z
  .email("Enter a valid email.")
  .trim()
  .toLowerCase()
  .refine(isAllowedEmail, `Use their @${ALLOWED_EMAIL_DOMAIN} Google account.`);

const newAccountSchema = z.object({ name, email, role });
const detailsSchema = z.object({ name, role });

function refresh() {
  revalidatePath("/portal", "layout");
}

/** Executives can't change their own role or access — that's how an account locks itself out. */
async function requireOtherAccount(id: string) {
  const executive = await requireExecutive();
  if (id === executive.id || id === BUILT_IN_ID) return { executive, error: { error: "You can’t change your own role or access. Ask another executive." } };
  const account = await store.get("accounts", id);
  if (!account) return { executive, error: { error: "This account no longer exists." } };
  return { executive, account, error: null };
}

export async function createAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const executive = await requireExecutive();
  const parsed = newAccountSchema.safeParse({ name: text(formData, "name"), email: text(formData, "email"), role: text(formData, "role") });
  if (!parsed.success) return toFormState(parsed.error);

  const taken = isBuiltInEmail(parsed.data.email) || (await store.list("accounts")).some((account) => account.email === parsed.data.email);
  if (taken) return { error: "Check the highlighted fields.", fieldErrors: { email: "There’s already an account with this email." } };

  await store.create("accounts", { ...parsed.data, active: true }, executive.email, `account ${parsed.data.name}`);
  refresh();
  redirect("/portal/accounts?notice=account-created");
}

export async function updateAccountDetails(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const target = await requireOtherAccount(id);
  if (target.error) return target.error;
  const parsed = detailsSchema.safeParse({ name: text(formData, "name"), role: text(formData, "role") });
  if (!parsed.success) return toFormState(parsed.error);

  await store.update("accounts", id, parsed.data, target.executive.email);
  refresh();
  redirect(`/portal/accounts/${id}?notice=account-updated`);
}

/** Access is re-checked on every request, so revoking takes effect on their next click. */
export async function setAccountAccess(id: string, active: boolean) {
  const target = await requireOtherAccount(id);
  if (target.error) redirect(`/portal/accounts/${id}`);

  await store.update("accounts", id, { active }, target.executive.email);
  refresh();
  redirect(`/portal/accounts/${id}?notice=${active ? "restored" : "revoked"}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { BUILT_IN_ID, isAllowedEmail, isBuiltInEmail, requireExecutive } from "@/lib/auth/session";
import { isMissingColumn, store } from "@/lib/data/store";
import { colleges } from "@/lib/applications/options";
import { accountRoles, affiliations, type AccountRole, type Affiliation } from "@/lib/data/types";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/supabase/config";
import { text, toFormState, type FormState } from "./form";

const role = z.enum(Object.keys(accountRoles) as [AccountRole, ...AccountRole[]], "Pick a role.");
const name = z.string().trim().min(2, "Add their name.").max(120);
const email = z
  .email("Enter a valid email.")
  .trim()
  .toLowerCase()
  .refine(isAllowedEmail, `Use their @${ALLOWED_EMAIL_DOMAIN} Google account.`);

const affiliation = z.enum(Object.keys(affiliations) as [Affiliation, ...Affiliation[]], "Pick Central or Local Comelec.");
const college = z.enum(colleges as unknown as [string, ...string[]], "Pick their college or faculty from the list.");

/** Executives manage the whole commission, so they're always Central. */
const centralExecutives = <T extends { role: AccountRole; affiliation: Affiliation }>(schema: z.ZodType<T>) =>
  schema.refine((value) => value.role !== "executive" || value.affiliation === "central", { path: ["affiliation"], message: "Executives are Central Comelec. Pick Central, or make them a commissioner." });

const newAccountSchema = centralExecutives(z.object({ name, email, role, affiliation, college }));
const detailsSchema = centralExecutives(z.object({ name, role, affiliation, college }));

const readAccess = (formData: FormData) => ({ role: text(formData, "role"), affiliation: text(formData, "affiliation"), college: text(formData, "college") });

function refresh() {
  revalidatePath("/portal", "layout");
}

/** Saving an account fails until supabase/migrations/0017 adds these columns. */
const affiliationColumns = ["affiliation", "college"];

const migrationNeeded: FormState = { error: "The database needs an update first. Run supabase/migrations/0017_account_affiliation.sql in the Supabase SQL Editor, then save again." };

/** Saves, turning the missing-columns error into a message on the form instead of an error page. */
async function save(write: () => Promise<unknown>): Promise<FormState | null> {
  try {
    await write();
    return null;
  } catch (error) {
    if (isMissingColumn(error, affiliationColumns)) return migrationNeeded;
    throw error;
  }
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
  const parsed = newAccountSchema.safeParse({ name: text(formData, "name"), email: text(formData, "email"), ...readAccess(formData) });
  if (!parsed.success) return toFormState(parsed.error);

  const taken = isBuiltInEmail(parsed.data.email) || (await store.list("accounts")).some((account) => account.email === parsed.data.email);
  if (taken) return { error: "Check the highlighted fields.", fieldErrors: { email: "There’s already an account with this email." } };

  const failed = await save(() => store.create("accounts", { ...parsed.data, active: true }, executive.email, `account ${parsed.data.name}`));
  if (failed) return failed;
  refresh();
  redirect("/portal/accounts?notice=account-created");
}

export async function updateAccountDetails(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const target = await requireOtherAccount(id);
  if (target.error) return target.error;
  const parsed = detailsSchema.safeParse({ name: text(formData, "name"), ...readAccess(formData) });
  if (!parsed.success) return toFormState(parsed.error);

  const failed = await save(() => store.update("accounts", id, parsed.data, target.executive.email));
  if (failed) return failed;
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

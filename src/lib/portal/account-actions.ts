"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { personNamePattern } from "@/lib/forms/input";
import { canSeeCollege, isBuiltInEmail, requireEditor, type PortalUser } from "@/lib/auth/session";
import { sameAccountUnit, detailsFor, facebookHref, fullName, isCentralRepresentative, isLocalChairperson, isRoleFor, officialName, positionsFor, programsOf, toSummary, upperName } from "@/lib/data/accounts";
import { isMissingColumn, store } from "@/lib/data/store";
import { comelecUnits, positions, isYearLevelFor, yearLevelsFor } from "@/lib/applications/options";
import { getApplication } from "@/lib/applications/admin";
import { officeOf } from "@/lib/data/accounts";
import { accountAffiliations, accountPositions, affiliations, type AccountAffiliation, type AccountKind, type AccountPosition, type PortalAccount } from "@/lib/data/types";
import { checkUpload, deleteUpload, hasFile, saveUpload } from "@/lib/data/uploads";
import { accountAccessEmail, accountAddedEmail, accountChanges, accountRemovedEmail, accountUpdatedEmail, changesAccess } from "@/lib/notifications/account-emails";
import { actorOf, later, sendAutomatic } from "@/lib/notifications/notify";
import { canManageAccount } from "./account-scope";
import { text, toFormState, type FormState } from "./form";

// Adding and managing portal accounts, from the Accounts tab. Whoever has that tab manages the
// accounts in their reach (./account-scope.ts): a Central account every unit's, a Local account its
// own college's, and nobody an account above their own position. The Directory and the website's
// About page are built from the commissioners' accounts, so saving one refreshes those too.
//
// A personal account is a commissioner's, an adviser's or an admin's; which details it has follows
// from its position (detailsFor). An official account is a unit's shared mailbox, with only its
// email and its unit.
//
// Whatever changes about an account, its owner is emailed: that it was added, what was updated,
// that its access was revoked or restored, that it was removed (src/lib/notifications/account-emails.ts),
// each unless it's switched off under Email Sender → Automatic.

const keys = <T extends object>(record: T) => Object.keys(record) as [keyof T & string, ...(keyof T & string)[]];
const namePart = (message: string) => z.string().trim().min(1, message).max(80).regex(personNamePattern, "Use letters and spaces only.");
const isUnit = (value: string) => comelecUnits.includes(value);

const email = z
  .email("Enter a valid email.")
  .trim()
  .toLowerCase()
  .refine((value) => value.endsWith("@ust.edu.ph"), "Use their @ust.edu.ph Google account.");

const personalSchema = z
  .object({
    lastName: namePart("Add their last name."),
    firstName: namePart("Add their first name."),
    middleName: namePart("Add their middle name."),
    yearLevel: z.string().trim(),
    studentNumber: z.string().trim(),
    affiliation: z.enum(keys(accountAffiliations), "Pick their affiliation."),
    position: z.enum(keys(accountPositions), "Pick their position."),
    role: z.string().trim(),
    college: z.string().trim(),
    program: z.string().trim(),
    facebookUrl: z.union([z.literal(""), z.string().trim().max(300).regex(/^(https?:\/\/)?(www\.|m\.|web\.)?(facebook|fb)\.com\/\S+$/i, "Use their Facebook profile link, like facebook.com/theirname.")]),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (!positionsFor(value.affiliation).includes(value.position)) return issue("position", value.affiliation === "osa" ? "The Office for Student Affairs’ accounts are Admins." : "Pick their position.");
    // Only the details the position has are checked; the rest are saved empty whatever was sent.
    const needs = detailsFor(value.affiliation, value.position);
    if (needs.role && !isRoleFor(value.affiliation, value.position, value.role)) issue("role", "Pick their role.");
    if (needs.program && !isYearLevelFor(value.college, value.yearLevel)) issue("yearLevel", "Pick their year level.");
    if (needs.studentNumber && !/^\d{10}$/.test(value.studentNumber)) issue("studentNumber", "Use their 10-digit student number.");
    if (needs.college === "required" ? !isUnit(value.college) : needs.college === "optional" && value.college !== "" && !isUnit(value.college)) return issue("college", "Pick their college or faculty from the list.");
    const programs = programsOf(value.college);
    if (needs.program && programs.length > 0 && !programs.includes(value.program)) issue("program", value.program ? "Pick a program from their college’s list." : "Pick their program.");
  });

const officialSchema = z
  .object({
    affiliation: z.enum(keys(affiliations), "Pick Central or Local Comelec."),
    college: z.string().trim(),
  })
  .refine((value) => value.affiliation === "central" || isUnit(value.college), { path: ["college"], message: "Pick the unit’s college or faculty from the list." });

type Personal = z.infer<typeof personalSchema>;

const readKind = (formData: FormData): AccountKind => (text(formData, "kind") === "official" ? "official" : "personal");

function readDetails(formData: FormData) {
  return {
    lastName: text(formData, "lastName"),
    firstName: text(formData, "firstName"),
    middleName: text(formData, "middleName"),
    yearLevel: text(formData, "yearLevel"),
    studentNumber: text(formData, "studentNumber"),
    affiliation: text(formData, "affiliation"),
    position: text(formData, "position"),
    role: text(formData, "role"),
    college: text(formData, "college"),
    program: text(formData, "program"),
    facebookUrl: text(formData, "facebookUrl"),
  };
}

/** Every field of an account but its email and what the portal keeps itself (photo, access, verification). */
type AccountFields = Pick<PortalAccount, "kind" | "name" | "lastName" | "firstName" | "middleInitial" | "middleName" | "yearLevel" | "studentNumber" | "affiliation" | "position" | "role" | "college" | "program" | "facebookUrl"> & { kind: AccountKind; affiliation: AccountAffiliation; position: AccountPosition; college: string | null };

/** A personal account's fields from the form: names in capitals, and nothing kept that the position doesn't have. */
function personalFields(data: Personal): AccountFields {
  const needs = detailsFor(data.affiliation, data.position);
  const lastName = upperName(data.lastName);
  const firstName = upperName(data.firstName);
  const middleName = upperName(data.middleName);
  const college = needs.college === "none" ? null : data.college || null;
  return {
    kind: "personal",
    name: fullName({ firstName, middleName, lastName }),
    lastName,
    firstName,
    middleInitial: null,
    middleName: middleName || null,
    yearLevel: needs.program ? data.yearLevel : null,
    studentNumber: needs.studentNumber ? data.studentNumber : null,
    affiliation: data.affiliation,
    position: data.position,
    role: needs.role ? data.role : "",
    college,
    program: needs.program && programsOf(college).length > 0 ? data.program : null,
    facebookUrl: data.facebookUrl ? facebookHref(data.facebookUrl) : null,
  };
}

/** An official account's fields: its unit, and a name made from it. It stands as its unit's Executive Board. */
function officialFields(data: z.infer<typeof officialSchema>): AccountFields {
  const college = data.affiliation === "local" ? data.college : null;
  return { kind: "official", name: officialName(data.affiliation, college), lastName: null, firstName: null, middleInitial: null, middleName: null, yearLevel: null, studentNumber: null, affiliation: data.affiliation, position: "executive-board", role: "", college, program: null, facebookUrl: null };
}

/** The form's values as an account's fields, or the form's errors. `fixed` is laid over what was sent, for what the sender can't change. */
function parseAccount(formData: FormData, fixed: Partial<{ kind: AccountKind; affiliation: string; position: string; college: string }> = {}): { fields: AccountFields; errors: null } | { fields: null; errors: FormState } {
  const input = { ...readDetails(formData), ...fixed };
  if ((fixed.kind ?? readKind(formData)) === "official") {
    const parsed = officialSchema.safeParse(input);
    return parsed.success ? { fields: officialFields(parsed.data), errors: null } : { fields: null, errors: toFormState(parsed.error) };
  }
  const parsed = personalSchema.safeParse(input);
  return parsed.success ? { fields: personalFields(parsed.data), errors: null } : { fields: null, errors: toFormState(parsed.error) };
}

function refresh() {
  // The Directory's public half: "Meet the commission", and the home page's count of members.
  revalidatePath("/about");
  revalidatePath("/");
  revalidatePath("/portal", "layout");
}

/** Saving an account fails until supabase/migrations/0021 and 0022 add these columns. */
const profileColumns = ["last_name", "first_name", "middle_initial", "middle_name", "year_level", "student_number", "program", "facebook_url", "position", "email_verified_at", "photo_url", "chamber_role", "kind"];

const migrationNeeded: FormState = { error: "The database needs an update first. Run supabase/migrations/0021_account_profiles_and_access.sql and 0022_official_accounts_and_viewers.sql, then 0041_account_middle_name_and_year_level.sql in the Supabase SQL Editor, then save again." };

/** Saves, and hands back what was saved. A not-yet-migrated database's errors come back as a message for the form (`failed`) instead of an error page. */
async function save<T>(write: () => Promise<T>): Promise<{ saved: T; failed?: undefined } | { saved?: undefined; failed: FormState }> {
  try {
    return { saved: await write() };
  } catch (error) {
    // A missing column, or a value an older check constraint doesn't know (Adviser, Admin, the Office for Student Affairs).
    if (isMissingColumn(error, profileColumns) || (error instanceof Error && /portal_accounts_(position|affiliation)_check/.test(error.message))) return { failed: migrationNeeded };
    throw error;
  }
}

const outOfReach = (manager: PortalUser): FormState => ({
  error:
    manager.affiliation === "local"
      ? `You can only manage ${manager.college ?? "your college"}’s Local Comelec accounts, at your own position or below.`
      : "That account isn’t yours to manage: it’s above your own position, or it’s one only the Central Executive Board manages.",
});

/** The built-in executive's own row only says how it's listed: it's always Central, and Executive Board if it's a person's. */
const builtInOnly: FormState = { error: "Check the highlighted fields.", fieldErrors: { position: "This is the built-in executive, which is always Central Comelec Executive Board." } };
const fitsBuiltIn = (fields: AccountFields) => fields.affiliation === "central" && fields.position === "executive-board";

/** Each college has one Central Representative (they sit in En Banc). Returns the form error when it's taken. */
function representativeTaken(accounts: PortalAccount[], fields: AccountFields, selfId?: string): FormState | null {
  if (fields.kind !== "personal" || !isCentralRepresentative(fields)) return null;
  const holder = accounts.map(toSummary).find((account) => account.active && account.id !== selfId && account.kind === "personal" && account.college === fields.college && isCentralRepresentative(account));
  if (!holder) return null;
  return { error: "Check the highlighted fields.", fieldErrors: { role: `${holder.name} is already this college’s Central Representative. Change or revoke their account first.` } };
}

async function readPhoto(formData: FormData) {
  const photo = formData.get("photo");
  if (!hasFile(photo)) return { upload: null };
  const photoError = await checkUpload(photo, "photo");
  if (photoError) return { error: { error: photoError, fieldErrors: { photo: photoError } } satisfies FormState };
  return { upload: await saveUpload(photo, "photo") };
}

async function addAccount(manager: PortalUser, formData: FormData): Promise<FormState> {
  const address = email.safeParse(text(formData, "email"));
  const { fields, errors } = parseAccount(formData);
  // Both at once, so the form shows every field to fix.
  if (!address.success || !fields) return { error: "Check the highlighted fields.", fieldErrors: { ...(errors?.fieldErrors ?? {}), ...(address.success ? {} : { email: address.error.issues[0].message }) } };

  if (isBuiltInEmail(address.data) && !fitsBuiltIn(fields)) return builtInOnly;
  if (!canManageAccount(manager, fields)) return outOfReach(manager);

  const accounts = await store.list("accounts");
  if (accounts.some((account) => account.email.trim().toLowerCase() === address.data && sameAccountUnit(toSummary(account), fields))) return { error: "Check the highlighted fields.", fieldErrors: { email: "There’s already an account with this email in this unit." } };
  const taken = representativeTaken(accounts, fields);
  if (taken) return taken;

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;

  // Added by hand, so the email is only proved when they first sign in with Google. Someone adding
  // their own row is signed in with it right now.
  const emailVerifiedAt = address.data === manager.email ? new Date().toISOString() : null;
  const { saved: added, failed } = await save(() => store.create("accounts", { ...fields, email: address.data, active: true, emailVerifiedAt, photoUrl: photo.upload?.url ?? null, chamberRole: null }, manager.email, `account ${fields.name}`));
  if (!added) {
    await deleteUpload(photo.upload?.url ?? null);
    return failed;
  }
  // Told that they've been added, unless they added themselves.
  if (formData.get("notifyEmail") === "on" && added.email !== manager.email) later(() => sendAutomatic("account-added", () => accountAddedEmail(toSummary(added), actorOf(manager))));
  refresh();
}

export async function createAccount(_state: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireEditor("accounts");
  const error = await addAccount(manager, formData);
  if (error) return error;
  redirect("/portal/accounts?notice=account-created");
}

/** The Directory is built from active personal accounts with a commissioner role. */
export async function onboardApplication(id: string): Promise<FormState> {
  const reviewer = await requireEditor("recruitment/applications");
  const manager = await requireEditor("accounts");
  const application = await getApplication(id);
  if (!application || !canSeeCollege(reviewer, application.college)) return { error: "This application is no longer available." };
  if (application.status !== "accepted") return { error: "Accept this application before onboarding." };
  if (application.preferredBodyId !== "central" && application.preferredBodyId !== "local") return { error: "This application has no valid Comelec unit." };

  const position = positions.find((item) => item.id === application.positionId);
  if (!position) return { error: "This application’s position is no longer available. Add their account under Accounts instead." };
  const role = officeOf(position.label.replace(/^Executive Assistant to the /, ""));
  const formData = new FormData();
  for (const [key, value] of Object.entries({
    kind: "personal",
    notifyEmail: "on",
    email: application.email,
    firstName: application.firstName,
    lastName: application.lastName,
    middleName: application.middleName,
    yearLevel: Object.entries(yearLevelsFor(application.college)).find(([key, label]) => application.yearLevel === key || application.yearLevel === label)?.[0] ?? "",
    studentNumber: application.studentNumber,
    affiliation: application.preferredBodyId,
    position: "executive-associate",
    role,
    college: application.college,
    program: application.program,
    facebookUrl: application.facebookUrl,
  })) formData.set(key, value);

  return addAccount(manager, formData);
}

export async function updateAccountDetails(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const manager = await requireEditor("accounts");
  const accounts = await store.list("accounts");
  const row = accounts.find((account) => account.id === id);
  if (!row) return { error: "This account no longer exists." };
  const existing = toSummary(row);
  const own = id === manager.id;
  if (!own && !canManageAccount(manager, existing)) return outOfReach(manager);

  // Your own category, unit and position are someone else's to change: that's how an account locks
  // itself out, or lets itself in. The rest of your details are yours to correct.
  const { fields, errors } = parseAccount(formData, own ? { kind: existing.kind, affiliation: existing.affiliation, position: existing.position, ...(existing.affiliation === "local" ? { college: existing.college ?? "" } : {}) } : {});
  if (!fields) return errors;

  if (isBuiltInEmail(existing.email) && !fitsBuiltIn(fields)) return builtInOnly;
  if (!own && !canManageAccount(manager, fields)) return outOfReach(manager);
  if (accounts.some((account) => account.id !== id && account.email.trim().toLowerCase() === existing.email.trim().toLowerCase() && sameAccountUnit(toSummary(account), fields))) return { error: "Check the highlighted fields.", fieldErrors: { affiliation: "There’s already an account with this email in this unit." } };
  const taken = representativeTaken(accounts, fields, id);
  if (taken) return taken;

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;
  const removePhoto = formData.get("removePhoto") === "on" || fields.kind === "official";
  const photoUrl = photo.upload?.url ?? (removePhoto ? null : existing.photoUrl);
  // A Primus or Vicar who is no longer a Local Chairperson leaves that role.
  const leavesChamber = existing.chamberRole && !(fields.kind === "personal" && isLocalChairperson(fields));

  const { saved: updated, failed } = await save(() => store.update("accounts", id, { ...fields, photoUrl, ...(leavesChamber ? { chamberRole: null } : {}) }, manager.email));
  if (failed) {
    await deleteUpload(photo.upload?.url ?? null);
    return failed;
  }
  if (photoUrl !== existing.photoUrl) await deleteUpload(existing.photoUrl);
  // The owner is told what changed, whoever changed it. Nothing is sent when the save changed nothing.
  if (updated) {
    const account = toSummary(updated);
    const changes = accountChanges(existing, account);
    if (changes.length) later(() => sendAutomatic("account-updated", () => accountUpdatedEmail(account, changes, actorOf(manager), { own, access: changesAccess(existing, account) })));
  }
  refresh();
  redirect(`/portal/accounts/${id}?notice=account-updated`);
}

/** Access is re-checked on every request, so revoking takes effect on their next click. A revoked account also leaves the Directory. */
export async function setAccountAccess(id: string, active: boolean) {
  const manager = await requireEditor("accounts");
  const row = await store.get("accounts", id);
  const account = row && toSummary(row);
  // Nobody revokes their own access, the built-in executive's can't be revoked, and the rest must be in reach.
  if (!account || id === manager.id || isBuiltInEmail(account.email) || !canManageAccount(manager, account)) redirect("/portal/accounts");

  await store.update("accounts", id, { active, ...(!active && account.chamberRole ? { chamberRole: null } : {}) }, manager.email);
  if (active !== account.active) later(() => sendAutomatic(active ? "account-restored" : "account-revoked", () => accountAccessEmail(account, active, actorOf(manager))));
  refresh();
  redirect(`/portal/accounts/${id}?notice=${active ? "restored" : "revoked"}`);
}

/**
 * Removes an account for good: they can't sign in, they leave the Directory, and their photo goes
 * with it. Revoking is the way to block someone and keep the record; this is for an account that
 * shouldn't exist.
 */
export async function deleteAccount(id: string) {
  const manager = await requireEditor("accounts");
  const row = await store.get("accounts", id);
  const account = row && toSummary(row);
  if (!account || id === manager.id || isBuiltInEmail(account.email) || !canManageAccount(manager, account)) redirect("/portal/accounts");

  const removed = await store.remove("accounts", id);
  await deleteUpload(removed?.photoUrl ?? null);
  if (removed) later(() => sendAutomatic("account-removed", () => accountRemovedEmail(account, actorOf(manager))));
  refresh();
  redirect("/portal/accounts?notice=account-deleted");
}

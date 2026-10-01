"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocal, requirePortalUser, type PortalUser } from "@/lib/auth/session";
import { colleges } from "@/lib/applications/options";
import { store } from "@/lib/data/store";
import { CENTRAL_REPRESENTATIVE, CHAIRPERSON, memberBodies, positionsFor, type ChamberRole, type Member, type MemberBody } from "@/lib/data/types";
import { checkUpload, deleteUpload, hasFile, saveUpload } from "@/lib/data/uploads";
import { text, toFormState, type FormState } from "./form";

const bodies = Object.keys(memberBodies) as [MemberBody, ...MemberBody[]];

const memberSchema = z
  .object({
    name: z.string().trim().min(2, "Add the member’s name.").max(120),
    position: z.string().trim(),
    body: z.enum(bodies, "Pick where they serve."),
    unit: z.string().trim().max(120),
  })
  .superRefine((value, ctx) => {
    if (!positionsFor(value.body).includes(value.position)) ctx.addIssue({ code: "custom", path: ["position"], message: "Pick their position." });
    // Every Local Comelec belongs to a college; for Central Comelec it's optional, but from the same list.
    const listed = (colleges as readonly string[]).includes(value.unit);
    if (value.body === "local" && !listed) ctx.addIssue({ code: "custom", path: ["unit"], message: "Pick their college." });
    if (value.body === "central" && value.unit && !listed) ctx.addIssue({ code: "custom", path: ["unit"], message: "Pick a college from the list, or clear the field." });
  });

function parse(formData: FormData) {
  return memberSchema.safeParse({ name: text(formData, "name"), position: text(formData, "position"), body: text(formData, "body"), unit: text(formData, "unit") });
}

/** Each college has one Central Representative (they sit in En Banc). Returns the form error when it's taken. */
function collegeTaken(members: Member[], data: { body: MemberBody; position: string; unit: string }, selfId?: string): FormState | null {
  if (data.body !== "local" || data.position !== CENTRAL_REPRESENTATIVE) return null;
  const holder = members.find((member) => member.body === "local" && member.position === CENTRAL_REPRESENTATIVE && member.unit === data.unit && member.id !== selfId);
  if (!holder) return null;
  return { error: "Check the highlighted fields.", fieldErrors: { unit: `${holder.name} is already this college’s Central Representative. Change or remove them first.` } };
}

/** Local accounts manage only their own college's Local Comelec; true when `member` is outside that. */
function outOfScope(user: PortalUser, member: { body: MemberBody; unit: string }) {
  return isLocal(user) && !(member.body === "local" && member.unit === user.college);
}

const scopeError = (user: PortalUser): FormState => ({ error: `You can only manage ${user.college ?? "your college"}’s Local Comelec.` });

/** The next free spot at the end of a group. */
const endOf = (members: Member[], body: MemberBody) => members.filter((member) => member.body === body).reduce((max, member) => Math.max(max, member.order), 0) + 1;

function refresh() {
  revalidatePath("/about");
  // The home page counts the commission's members.
  revalidatePath("/");
  revalidatePath("/portal", "layout");
}

async function readPhoto(formData: FormData) {
  const photo = formData.get("photo");
  if (!hasFile(photo)) return { upload: null };
  const photoError = await checkUpload(photo, "photo");
  if (photoError) return { error: { error: photoError, fieldErrors: { photo: photoError } } satisfies FormState };
  return { upload: await saveUpload(photo, "photo") };
}

export async function createMember(_state: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePortalUser();
  const { email } = user;
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);
  if (outOfScope(user, parsed.data)) return scopeError(user);

  const members = await store.list("members");
  const taken = collegeTaken(members, parsed.data);
  if (taken) return taken;

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;

  // New members go to the end of their group; drag them into place in the directory.
  await store.create("members", { ...parsed.data, order: endOf(members, parsed.data.body), photoUrl: photo.upload?.url ?? null }, email, `${parsed.data.body} ${parsed.data.name}`);
  refresh();
  redirect("/portal/members?notice=created");
}

export async function updateMember(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const user = await requirePortalUser();
  const { email } = user;
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  const members = await store.list("members");
  const existing = members.find((member) => member.id === id);
  if (!existing) return { error: "This member no longer exists." };
  if (outOfScope(user, existing) || outOfScope(user, parsed.data)) return scopeError(user);
  const taken = collegeTaken(members, parsed.data, id);
  if (taken) return taken;

  const photo = await readPhoto(formData);
  if (photo.error) return photo.error;
  const removePhoto = formData.get("removePhoto") === "on";
  const photoUrl = photo.upload?.url ?? (removePhoto ? null : existing.photoUrl);
  // Moving to another group puts them at its end.
  const order = parsed.data.body === existing.body ? existing.order : endOf(members, parsed.data.body);
  // A Primus or Vicar who is no longer a Local Chairperson leaves that role. (Only written when set,
  // so this still works before supabase/migrations/0012 adds the column.)
  const leavesChamber = existing.chamberRole && !(parsed.data.body === "local" && parsed.data.position === CHAIRPERSON);

  await store.update("members", id, { ...parsed.data, order, photoUrl, ...(leavesChamber ? { chamberRole: null } : {}) }, email);
  if (photoUrl !== existing.photoUrl) await deleteUpload(existing.photoUrl);
  refresh();
  redirect("/portal/members?notice=updated");
}

/**
 * Saves the order of one group after a drag in the Directory. `ids` is the whole group,
 * first to last; only members whose place changed are written. Local Comelec is ordered within each
 * college, so it's reordered one `college` at a time.
 */
export async function reorderMembers(body: MemberBody, ids: string[], college?: string): Promise<{ error?: string }> {
  const user = await requirePortalUser();
  const { email } = user;
  if (outOfScope(user, { body, unit: college ?? "" })) return { error: scopeError(user)!.error };
  const group = (await store.list("members")).filter((member) => member.body === body && (body !== "local" || member.unit === college));
  if (ids.length !== group.length || !group.every((member) => ids.includes(member.id))) {
    return { error: "The directory changed while you were dragging. Reload the page and try again." };
  }

  try {
    await Promise.all(
      ids.map((id, index) => {
        const member = group.find((item) => item.id === id)!;
        return member.order === index + 1 ? null : store.update("members", id, { order: index + 1 }, email);
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn’t save the new order." };
  }
  refresh();
  return {};
}

/**
 * Makes a Local Chairperson the Chamber of Chairpersons' Primus or Vicar (null: a regular member).
 * There's one of each, so whoever held the role before becomes a regular member.
 */
export async function setChamberRole(id: string, role: ChamberRole | null): Promise<{ error?: string }> {
  const user = await requirePortalUser();
  const { email } = user;
  if (isLocal(user)) return { error: "Only the Central Comelec sets the Chamber of Chairpersons’ Primus and Vicar." };
  const members = await store.list("members");
  const member = members.find((item) => item.id === id);
  if (!member || member.body !== "local" || member.position !== CHAIRPERSON) return { error: "Only Local Comelec Chairpersons are in the Chamber of Chairpersons." };
  if ((member.chamberRole ?? null) === role) return {};

  try {
    const holder = role && members.find((item) => item.chamberRole === role && item.id !== id);
    if (holder) await store.update("members", holder.id, { chamberRole: null }, email);
    await store.update("members", id, { chamberRole: role }, email);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { error: message.includes("chamber_role") ? "Run supabase/migrations/0012_directory_groups.sql in the Supabase SQL Editor first." : message || "Couldn’t save the role." };
  }
  refresh();
  return {};
}

export async function deleteMember(id: string) {
  const user = await requirePortalUser();
  const member = await store.get("members", id);
  if (member && outOfScope(user, member)) redirect("/portal/members");
  const removed = await store.remove("members", id);
  await deleteUpload(removed?.photoUrl ?? null);
  refresh();
  redirect("/portal/members?notice=deleted");
}

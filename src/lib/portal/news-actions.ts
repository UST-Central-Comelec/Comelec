"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePortalUser } from "@/lib/auth/session";
import { store } from "@/lib/data/store";
import { newsCategories, type NewsCategory } from "@/lib/data/types";
import { text, toFormState, type FormState } from "./form";

const newsSchema = z.object({
  title: z.string().trim().min(3, "Add a title.").max(160, "Keep the title under 160 characters."),
  category: z.enum(Object.keys(newsCategories) as [NewsCategory, ...NewsCategory[]], "Pick a category."),
  date: z.iso.date("Pick a publish date."),
  excerpt: z.string().trim().min(10, "Add a short summary (at least 10 characters).").max(300, "Keep the summary under 300 characters."),
  body: z.string().trim().max(20000, "The article is too long."),
  featured: z.boolean(),
});

function parse(formData: FormData) {
  return newsSchema.safeParse({
    title: text(formData, "title"),
    category: text(formData, "category"),
    date: text(formData, "date"),
    excerpt: text(formData, "excerpt"),
    body: text(formData, "body"),
    featured: formData.get("featured") === "on",
  });
}

async function refresh(featuredId: string | null, author: string) {
  // The newsroom leads with a single featured story, so featuring one un-features the rest.
  if (featuredId) {
    for (const post of await store.list("news")) {
      if (post.featured && post.id !== featuredId) await store.update("news", post.id, { featured: false }, author);
    }
  }
  revalidatePath("/news");
  revalidatePath("/news/[id]", "page");
  revalidatePath("/portal", "layout");
}

export async function createNews(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  const post = await store.create("news", parsed.data, email, parsed.data.title);
  await refresh(post.featured ? post.id : null, email);
  redirect("/portal/news?notice=created");
}

export async function updateNews(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requirePortalUser();
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  const post = await store.update("news", id, parsed.data, email);
  if (!post) return { error: "This post no longer exists." };
  await refresh(post.featured ? post.id : null, email);
  redirect("/portal/news?notice=updated");
}

export async function deleteNews(id: string) {
  const { email } = await requirePortalUser();
  await store.remove("news", id);
  await refresh(null, email);
  redirect("/portal/news?notice=deleted");
}

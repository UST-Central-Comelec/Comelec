"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireEditor } from "@/lib/auth/session";
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
  const category = text(formData, "category");
  return newsSchema.safeParse({
    title: text(formData, "title"),
    category,
    date: text(formData, "date"),
    excerpt: text(formData, "excerpt"),
    body: text(formData, "body"),
    // Only the News page has a featured post; an explainer is never one.
    featured: category !== "explainer" && formData.get("featured") === "on",
  });
}

/** Why saving failed, in words a commissioner can act on. */
function saveError(error: unknown): FormState {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Couldn’t save the post:", message);
  // The database still has the old list of categories, which has no Publication.
  if (message.includes("news_category_check")) return { error: "The database doesn’t know this category yet. Run supabase/migrations/0020_news_categories_and_statistics.sql in the Supabase SQL Editor, then save again." };
  return { error: "Something went wrong saving the post. Please try again." };
}

async function refresh(featuredId: string | null, author: string) {
  // The News page sets a single featured post apart, so featuring one un-features the rest.
  if (featuredId) {
    for (const post of await store.list("news")) {
      if (post.featured && post.id !== featuredId) await store.update("news", post.id, { featured: false }, author);
    }
  }
  // Every page: besides News and the Election Explainer, the menu's Featured carousel shows the latest posts.
  revalidatePath("/", "layout");
}

export async function createNews(_state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireEditor("news");
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  let post;
  try {
    post = await store.create("news", parsed.data, email, parsed.data.title);
  } catch (error) {
    return saveError(error);
  }
  await refresh(post.featured ? post.id : null, email);
  redirect("/portal/news?notice=created");
}

export async function updateNews(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const { email } = await requireEditor("news");
  const parsed = parse(formData);
  if (!parsed.success) return toFormState(parsed.error);

  let post;
  try {
    post = await store.update("news", id, parsed.data, email);
  } catch (error) {
    return saveError(error);
  }
  if (!post) return { error: "This post no longer exists." };
  await refresh(post.featured ? post.id : null, email);
  redirect("/portal/news?notice=updated");
}

export async function deleteNews(id: string) {
  const { email } = await requireEditor("news");
  await store.remove("news", id);
  await refresh(null, email);
  redirect("/portal/news?notice=deleted");
}

import type { Metadata } from "next";
import Link from "next/link";
import { NewsForm } from "@/components/portal/news-form";
import { requirePortalUser } from "@/lib/auth/session";
import { createNews } from "@/lib/portal/news-actions";

export const metadata: Metadata = { title: "New post" };

export default async function NewNewsPage() {
  await requirePortalUser();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <Link className="portal-back" href="/portal/news">← News</Link>
          <h1>New post</h1>
        </div>
      </header>
      <section className="portal-card">
        <NewsForm action={createNews} submitLabel="Publish post" initial={{ title: "", category: "announcement", date: today, excerpt: "", body: "", featured: false }} />
      </section>
    </main>
  );
}

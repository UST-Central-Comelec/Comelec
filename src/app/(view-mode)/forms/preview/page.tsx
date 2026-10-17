import type { Metadata } from "next";
import { withPortalUser } from "@/lib/auth/session";
import { FormViewMode } from "@/components/form-view-mode";

export const metadata: Metadata = { title: "Form (view mode)" };

export default async function FormPreviewPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  await withPortalUser(Promise.resolve(null));
  const { draft = "" } = await searchParams;
  return <FormViewMode token={draft} />;
}

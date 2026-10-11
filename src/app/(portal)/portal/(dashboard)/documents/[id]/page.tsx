import { redirect } from "next/navigation";

export default async function LegacyDocumentPage({ params, searchParams }: PageProps<"/portal/documents/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) values.append(key, item);
  }
  redirect(`/portal/documents/archive/${encodeURIComponent(id)}${values.size ? `?${values}` : ""}`);
}

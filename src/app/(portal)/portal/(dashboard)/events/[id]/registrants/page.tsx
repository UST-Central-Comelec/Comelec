import { redirect } from "next/navigation";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) value.forEach(item => search.append(key, item));
    else if (value !== undefined) search.set(key, value);
  }
  const suffix = search.size ? `?${search}` : "";
  redirect(`/portal/events/${id}/responses${suffix}`);
}

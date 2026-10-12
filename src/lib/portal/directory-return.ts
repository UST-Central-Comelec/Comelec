/** Only the directory may supply this contextual return link. Keep its view and filters. */
export function directoryReturnHref(value: string | null | undefined): string | null {
  if (!value?.startsWith("/portal/members")) return null;
  const url = new URL(value, "https://portal.invalid");
  if (url.origin !== "https://portal.invalid" || url.pathname !== "/portal/members") return null;
  const params = new URLSearchParams();
  if (url.searchParams.get("view") === "database") params.set("view", "database");
  for (const key of ["college", "unit", "q"]) {
    const text = url.searchParams.get(key);
    if (text && text.length <= 500) params.set(key, text);
  }
  return `/portal/members${params.size ? `?${params}` : ""}`;
}

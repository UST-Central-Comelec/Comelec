/** Reviews return only to an account list, preserving its unit and category filters. */
export function accountReviewReturnHref(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 4000) return "/portal/accounts";
  try {
    const url = new URL(value, "https://portal.invalid");
    if (url.origin !== "https://portal.invalid" || !["/portal/accounts", "/portal/accounts/approvals"].includes(url.pathname)) return "/portal/accounts";
    url.searchParams.delete("notice");
    return `${url.pathname}${url.search}`;
  } catch {
    return "/portal/accounts";
  }
}

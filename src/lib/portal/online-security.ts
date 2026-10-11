/** Browser writes must originate from this site, including requests without an Origin header. */
export function isSameSiteRequest(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  return origin ? origin === new URL(request.url).origin : site === "same-origin";
}

import { uploadRules } from "@/lib/data/uploads";
import { getPublicObject, isR2Configured } from "@/lib/storage/r2";

// Public-bucket files served from this site, for when R2_PUBLIC_URL (a custom domain) isn't set.
// Some networks block r2.dev, so photos come through here instead. Only what the site itself
// uploads is passed on: its folders and image types. Anything else dropped into the bucket by hand
// (an HTML page, say) never gets served from this origin.

const allowed = Object.values(uploadRules).map((rule) => ({ folder: `${rule.folder}/`, types: new Set(Object.keys(rule.types)) }));
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const rule = allowed.find((entry) => key.startsWith(entry.folder));
  if (!rule || !/^[\w\-/.]+$/.test(key) || key.includes("..") || !isR2Configured()) return notFound();

  const object = await getPublicObject(key, request).catch(() => null);
  if (!object) return new Response("File unavailable. Please try again.", { status: 503 });
  if (object.status === 404) return notFound();
  if (object.status === 304) return new Response(null, { status: 304, headers: { ETag: object.headers.get("etag") ?? "" } });
  const type = object.headers.get("content-type") ?? "";
  if (!object.ok || !rule.types.has(type)) {
    object.body?.cancel().catch(() => {});
    return object.ok ? notFound() : new Response("File unavailable. Please try again.", { status: 503 });
  }

  // The locked-down Content-Security-Policy for these responses is set in next.config.ts.
  const headers = new Headers({ "Content-Type": type, "Cache-Control": object.headers.get("cache-control") ?? "public, max-age=3600" });
  for (const name of ["content-length", "etag", "last-modified", "content-range", "accept-ranges"]) {
    const value = object.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(object.body, { status: object.status, headers });
}

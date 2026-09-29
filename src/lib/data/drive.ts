import "server-only";

// Official documents live in the commission's Google Drive; the site links to them.

/**
 * Accepts the usual ways a Drive file link gets copied (…/file/d/<id>/view?usp=sharing,
 * open?id=<id>, uc?id=<id>, Google Docs/Sheets/Slides links) and returns a clean view link.
 */
export function normalizeDriveLink(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  if (url.hostname === "drive.google.com") {
    const id = url.pathname.match(/^\/file\/d\/([\w-]{10,})/)?.[1] ?? (["/open", "/uc"].includes(url.pathname) ? url.searchParams.get("id") : null);
    return id && /^[\w-]{10,}$/.test(id) ? `https://drive.google.com/file/d/${id}/view` : null;
  }

  if (url.hostname === "docs.google.com") {
    const match = url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([\w-]{10,})/);
    return match ? `https://docs.google.com/${match[1]}/d/${match[2]}/view` : null;
  }

  return null;
}

/**
 * Checks the link opens for someone who isn't signed in. Private files redirect to Google's
 * sign-in page. Returns an error message, or null when it's public (or Google can't be reached —
 * a network hiccup shouldn't block saving).
 */
export async function checkDriveSharing(link: string) {
  try {
    const response = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(6000), cache: "no-store" });
    const location = response.headers.get("location") ?? "";
    if (response.status >= 300 && response.status < 400 && location.includes("accounts.google.com")) {
      return "This file is private. In Google Drive, set Share → General access to “Anyone with the link” (Viewer), then save again.";
    }
    if (response.status === 404) return "Google Drive couldn’t find this file. Check the link.";
    return null;
  } catch {
    return null;
  }
}

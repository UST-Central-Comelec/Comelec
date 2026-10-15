"use client";
import { CopyIcon } from "@/components/action-icons";
import { toast } from "./toast";

export function SurveyCopyLink({ path }: { path: string }) {
  return <button type="button" className="portal-button is-ghost" onClick={async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}${path}`); toast("Survey link copied to clipboard."); }
    catch { toast("Couldn’t copy the link. Try again.", "error"); }
  }}><CopyIcon size={15} aria-hidden="true" />Copy survey link</button>;
}

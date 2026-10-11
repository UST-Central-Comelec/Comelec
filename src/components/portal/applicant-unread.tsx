"use client";
import { useEffect } from "react";
import { seeApplicants } from "@/lib/portal/applicant-view-actions";

/** Mark only the rows actually rendered, after hydration; prefetch never marks applicants seen. */
export function ApplicantsSeen({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    let started = false;
    const mark = async () => {
      if (started || document.visibilityState === "hidden") return;
      started = true;
      try {
        if (await seeApplicants(key.split(","))) window.dispatchEvent(new Event("portal-applicants-seen"));
      } catch { /* The badge remains unread if saving fails. */ }
    };
    void mark();
    document.addEventListener("visibilitychange", mark);
    return () => { document.removeEventListener("visibilitychange", mark); };
  }, [key]);
  return null;
}

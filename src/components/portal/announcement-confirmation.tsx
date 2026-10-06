"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";

export function AnnouncementConfirmation() {
  const [visible, setVisible] = useState(true);
  const dismiss = useCallback(() => {
    setVisible(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("notice") === "sent") {
      url.searchParams.delete("notice");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [dismiss]);

  if (!visible) return null;
  return <div className="portal-announcement-confirmation">
    <span className="portal-announcement-confirmation-icon"><Check size={17} aria-hidden="true" /></span>
    <p role="status">Announcement sent.</p>
    <button type="button" aria-label="Dismiss confirmation" onClick={dismiss}><X size={15} aria-hidden="true" /></button>
  </div>;
}

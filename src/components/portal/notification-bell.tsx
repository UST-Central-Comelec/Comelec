"use client";

import { ViewIcon as ActionViewIcon } from "@/components/action-icons";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import type { InboxPreview } from "@/lib/notifications/inbox-rules";
import { senderLabel } from "@/lib/notifications/inbox-presentation";
import { Busy } from "@/components/busy";

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type NotificationPreview = Pick<InboxPreview, "id" | "title" | "senderName" | "senderAffiliation" | "senderCollege" | "createdAt" | "readAt" | "preview"> & { href?: string };

export function NotificationBell({ mobile = false, filing = false }: { mobile?: boolean; filing?: boolean }) {
  const panelId = useId();
  const [messages, setMessages] = useState<NotificationPreview[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [inboxAvailable, setInboxAvailable] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Changing page, focusing the window and showing the tab check at most every 15 seconds; reading or
  // deleting a notification, a phone/desktop switch and the minute timer check straight away.
  const lastLoaded = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const phone = window.matchMedia("(max-width: 860px)");
    let pending = false;
    const load = async (force = false) => {
      if (document.visibilityState === "hidden") return;
      if (phone.matches !== mobile) return;
      if (!force && Date.now() - lastLoaded.current < 15_000) return;
      lastLoaded.current = Date.now();
      pending = true;
      try {
        const response = await fetch(filing ? "/filing/announcements/latest" : "/portal/notifications/latest", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        setMessages(data.messages);
        setUnread(data.unreadCount);
        setInboxAvailable(data.inboxAvailable);
        setError(false);
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) { setError(true); setLoaded(true); }
      } finally {
        pending = false;
      }
    };
    const throttled = () => void load();
    const forced = () => void load(true);
    void load();
    const timer = window.setInterval(forced, 60000);
    window.addEventListener("focus", throttled);
    phone.addEventListener("change", forced);
    window.addEventListener(filing ? "filing-notices-read" : "portal-notifications-changed", forced);
    document.addEventListener("visibilitychange", throttled);
    return () => {
      // A check cut short by leaving the page doesn't count: the next page makes its own.
      if (pending) lastLoaded.current = 0;
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", throttled);
      phone.removeEventListener("change", forced);
      window.removeEventListener(filing ? "filing-notices-read" : "portal-notifications-changed", forced);
      document.removeEventListener("visibilitychange", throttled);
    };
  }, [pathname, mobile, filing]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const historyHref = filing ? "/filing/announcements" : inboxAvailable ? "/portal/apps/inbox?tab=all" : "/portal/notifications";
  return <div className="portal-notifications" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={button} type="button" className={`portal-notification-bell${unread > 0 ? " has-unread" : ""}`} aria-label={`${filing ? "Announcements" : "Notifications"}${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <Bell size={16} aria-hidden="true" />{unread > 0 && <span className="portal-notification-dot" aria-hidden="true" />}
    </button>
    {open && <section id={panelId} className="portal-notification-panel" aria-label={filing ? "Latest announcements" : "Latest notifications"}>
      <div className="portal-notification-heading"><div><strong>{filing ? "Announcements" : "Notifications"}</strong><p>Your latest updates, at a glance.</p></div>{unread > 0 ? <span className="portal-notification-count">{unread} unread</span> : loaded && !error && <CheckCheck size={18} aria-label="All read" />}</div>
      <div className="portal-notification-body">
      {error ? <p role="status" className="portal-empty">{filing ? "Announcements" : "Notifications"} are unavailable. Try again shortly.</p>
        : !loaded ? <p className="portal-empty">{filing ? <Busy>Loading announcements</Busy> : <Busy>Loading notifications</Busy>}</p>
        : !messages.length ? <p className="portal-empty">You’re all caught up.</p>
        : <ul>{messages.slice(0, 6).map((message) => {
          return <li key={message.id}><Link href={message.href ?? `${historyHref}#message-${message.id}`} className={message.readAt ? undefined : "is-unread"} onClick={() => setOpen(false)}>
            <span className="portal-notification-copy"><span className="portal-notification-meta"><span className="portal-notification-unit" title={message.senderName}>{senderLabel(message)}</span><time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))} PHT</time>{!message.readAt && <span className="portal-notification-item-dot" aria-label="Unread" />}</span><strong>{message.title}</strong><span className="portal-notification-preview">{message.preview}</span></span>
          </Link></li>;
        })}</ul>}
      </div>
      <Link href={historyHref} className="portal-notification-all" onClick={() => setOpen(false)}>{filing ? "View all announcements" : "View all notifications"}<ActionViewIcon size={15} aria-hidden="true" /></Link>
    </section>}
  </div>;
}

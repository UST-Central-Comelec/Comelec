"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import type { InboxMessage } from "@/lib/notifications/inbox-rules";
import { senderLabel } from "@/lib/notifications/inbox-presentation";
import { documentBodyText, parseDocumentBody } from "@/lib/data/document-body";

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const panelId = useId();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [inboxAvailable, setInboxAvailable] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const controller = new AbortController();
    const phone = window.matchMedia("(max-width: 860px)");
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      if (phone.matches !== mobile) return;
      try {
        const response = await fetch("/portal/notifications/latest", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Unavailable");
        const data = await response.json();
        setMessages(data.messages);
        setUnread(data.unreadCount);
        setInboxAvailable(data.inboxAvailable);
        setError(false);
        setLoaded(true);
      } catch {
        if (!controller.signal.aborted) { setError(true); setLoaded(true); }
      }
    };
    void load();
    const timer = window.setInterval(load, 60000);
    window.addEventListener("focus", load);
    phone.addEventListener("change", load);
    window.addEventListener("portal-notifications-changed", load);
    document.addEventListener("visibilitychange", load);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener("focus", load);
      phone.removeEventListener("change", load);
      window.removeEventListener("portal-notifications-changed", load);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname, mobile]);

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

  const historyHref = inboxAvailable ? "/portal/apps/inbox?tab=all" : "/portal/notifications";
  return <div className="portal-notifications" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={button} type="button" className={`portal-notification-bell${unread > 0 ? " has-unread" : ""}`} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <Bell size={16} aria-hidden="true" />{unread > 0 && <span className="portal-notification-dot" aria-hidden="true" />}
    </button>
    {open && <section id={panelId} className="portal-notification-panel" aria-label="Latest notifications">
      <div className="portal-notification-heading"><div><strong>Notifications</strong><p>Your latest updates, at a glance.</p></div>{unread > 0 ? <span className="portal-notification-count">{unread} unread</span> : loaded && !error && <CheckCheck size={18} aria-label="All read" />}</div>
      {error ? <p role="status" className="portal-empty">Notifications are unavailable. Try again shortly.</p>
        : !loaded ? <p className="portal-empty">Loading notifications…</p>
        : !messages.length ? <p className="portal-empty">You’re all caught up.</p>
        : <ul>{messages.slice(0, 6).map((message) => {
          return <li key={message.id}><Link href={`${historyHref}#message-${message.id}`} className={message.readAt ? undefined : "is-unread"} onClick={() => setOpen(false)}>
            <span className="portal-notification-copy"><span className="portal-notification-meta"><span className="portal-notification-unit" title={message.senderName}>{senderLabel(message)}</span><time dateTime={message.createdAt}>{timeFormat.format(new Date(message.createdAt))} PHT</time>{!message.readAt && <span className="portal-notification-item-dot" aria-label="Unread" />}</span><strong>{message.title}</strong><span className="portal-notification-preview">{documentBodyText(parseDocumentBody(message.body))}</span></span>
          </Link></li>;
        })}</ul>}
      <Link href={historyHref} className="portal-notification-all" onClick={() => setOpen(false)}>View all notifications<ArrowRight size={15} aria-hidden="true" /></Link>
    </section>}
  </div>;
}

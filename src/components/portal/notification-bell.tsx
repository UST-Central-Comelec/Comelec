"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import type { InboxMessage } from "@/lib/notifications/inbox-rules";

export function NotificationBell({ mobile = false }: { mobile?: boolean }) {
  const panelId = useId();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);
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

  const unread = messages.filter((message) => !message.readAt).length;
  return <div className="portal-notifications" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={button} type="button" className="portal-notification-bell" aria-label={`Notifications${unread ? ", unread notifications" : ""}`} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <Bell size={19} aria-hidden="true" />{unread > 0 && <span className="portal-notification-dot" aria-hidden="true" />}
    </button>
    {open && <section id={panelId} className="portal-notification-panel" aria-label="Latest notifications">
      <div className="portal-notification-heading"><strong>Notifications</strong>{unread > 0 && <span>Unread items</span>}</div>
      {error ? <p role="status" className="portal-empty">Notifications are unavailable. Try again shortly.</p>
        : !loaded ? <p className="portal-empty">Loading notifications…</p>
        : !messages.length ? <p className="portal-empty">You’re all caught up.</p>
        : <ul>{messages.slice(0, 6).map((message) => <li key={message.id}><Link href={`/portal/notifications#message-${message.id}`} className={message.readAt ? undefined : "is-unread"} onClick={() => setOpen(false)}>
          <strong>{message.title}</strong><span>{message.senderName}</span><time dateTime={message.createdAt}>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(message.createdAt))}</time>
        </Link></li>)}</ul>}
      <Link href="/portal/notifications" className="portal-notification-all" onClick={() => setOpen(false)}>View all notifications</Link>
    </section>}
  </div>;
}

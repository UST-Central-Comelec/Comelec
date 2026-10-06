"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { Check, CheckCheck, Inbox, Search, Trash2, Users, X } from "lucide-react";
import { DocumentBody } from "@/components/document-body";
import { documentBodyText, parseDocumentBody } from "@/lib/data/document-body";
import { recipientMention, senderLabel } from "@/lib/notifications/inbox-presentation";
import type { InboxMessage } from "@/lib/notifications/inbox-rules";
import { deleteAnnouncement, readNotification } from "@/lib/portal/inbox-actions";
import { SlidingFilters } from "./sliding-filters";

const inboxFilters = [
  { key: "all", href: "/portal/apps/inbox?tab=all", label: "All Messages" },
  { key: "read", href: "/portal/apps/inbox?tab=read", label: "Read" },
  { key: "unread", href: "/portal/apps/inbox?tab=unread", label: "Unread" },
];

const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });

export function InboxMessages({ messages, empty, tab }: { messages: InboxMessage[]; empty: string; tab?: "all" | "read" | "unread" }) {
  const id = useId();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase();
  const shown = messages.filter((message) => !search || `${message.title} ${documentBodyText(parseDocumentBody(message.body))} ${message.senderName} ${senderLabel(message)} ${recipientMention(message)}`.toLocaleLowerCase().includes(search));

  useEffect(() => {
    const openLinkedMessage = () => {
      const messageId = window.location.hash.replace(/^#message-/, "");
      if (messages.some((message) => message.id === messageId)) {
        setExpanded(messageId);
        setQuery("");
      }
    };
    const frame = window.requestAnimationFrame(openLinkedMessage);
    window.addEventListener("hashchange", openLinkedMessage);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("hashchange", openLinkedMessage); };
  }, [messages]);

  const markRead = (messageId: string) => {
    setReading(messageId);
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await readNotification(messageId);
        setError(result.error);
        if (!result.error) window.dispatchEvent(new Event("portal-notifications-changed"));
      } catch { setError("Couldn’t mark this as read. Try again."); }
      finally { setReading(null); }
    });
  };

  const removeAnnouncement = (messageId: string) => {
    setDeleting(messageId);
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await deleteAnnouncement(messageId);
        setError(result.error);
        if (!result.error) {
          setExpanded(null);
          window.dispatchEvent(new Event("portal-notifications-changed"));
        }
      } catch { setError("Couldn’t delete the announcement. Try again."); }
      finally { setDeleting(null); }
    });
  };

  return <div className="portal-inbox-list">
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    <div className="portal-inbox-toolbar">
      {tab && <SlidingFilters label="Filter messages by read status" active={tab} items={inboxFilters} />}
      <div className="portal-inbox-search">
        <Search size={16} aria-hidden="true" />
        <input type="search" aria-label="Search messages on this page" placeholder="Search this page…" value={query} onChange={(event) => setQuery(event.target.value)} />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14} aria-hidden="true" /></button>}
      </div>
    </div>
    <section className="portal-inbox-panel" aria-label="Messages">
      <div className="portal-inbox-panel-heading"><span>{tab === "read" ? "Read messages" : tab === "unread" ? "Unread messages" : "Latest updates"}</span><span>{shown.length} {shown.length === 1 ? "message" : "messages"} on this page</span></div>
      {!shown.length && <div className="portal-inbox-empty" role="status">
        <span className="portal-inbox-empty-icon"><Inbox size={27} strokeWidth={1.5} aria-hidden="true" /></span>
        <h2>{search ? "No matching messages" : "You’re all caught up"}</h2>
        <p>{search ? "Try another title, sender or keyword." : empty}</p>
        {search && <button type="button" className="portal-button is-ghost" onClick={() => setQuery("")}>Clear search</button>}
      </div>}
      {shown.map((message) => {
        const open = expanded === message.id;
        const bodyId = `${id}-${message.id}`;
        const blocks = parseDocumentBody(message.body);
        return <article key={message.id} id={`message-${message.id}`} className={`portal-inbox-message${message.readAt ? "" : " is-unread"}${open ? " is-expanded" : ""}`}>
          <button type="button" className="portal-inbox-message-toggle" aria-expanded={open} aria-controls={bodyId} onClick={() => setExpanded(open ? null : message.id)}>
            <span className="portal-inbox-label" title={message.senderName}>{senderLabel(message)}{!message.readAt && <span className="portal-inbox-row-dot" aria-label="Unread" />}</span>
            <span className="portal-inbox-message-summary">
              <span className="portal-inbox-subject">{message.title}</span>
              <span className="portal-inbox-row-separator" aria-hidden="true">–</span>
              <span className="portal-inbox-preview">{documentBodyText(blocks)}</span>
            </span>
            <time className="portal-inbox-message-time" dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))} PHT</time>
          </button>
          <div className="portal-inbox-message-content" id={bodyId} hidden={!open}>
            <div className="portal-inbox-detail-heading"><h2>{message.title}</h2><p>TO: {recipientMention(message)} <span>· {message.kind === "announcement" ? "Announcement" : "Account activity"}</span></p></div>
            <div className="portal-inbox-body portal-body-preview"><DocumentBody blocks={blocks} /></div>
            <div className="portal-inbox-message-footer">
              <span className="portal-inbox-audience"><Users size={14} aria-hidden="true" />From {message.senderName}</span>
              <div className="portal-inbox-message-actions">{message.readAt ? <span className="portal-inbox-read-status"><CheckCheck size={15} aria-hidden="true" />Read</span>
                : <button type="button" className="portal-inbox-read-button" disabled={pending} onClick={() => markRead(message.id)}><Check size={15} aria-hidden="true" />{pending && reading === message.id ? "Marking as read…" : "Mark as read"}</button>}
                {message.kind === "announcement" && <button type="button" className="portal-inbox-read-button is-delete" aria-label={`Delete ${message.title} from your inbox`} disabled={pending} onClick={() => removeAnnouncement(message.id)}><Trash2 size={14} aria-hidden="true" />{pending && deleting === message.id ? "Deleting…" : "Delete"}</button>}
              </div>
            </div>
          </div>
        </article>;
      })}
    </section>
  </div>;
}

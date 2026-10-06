"use client";

import { useState, useTransition } from "react";
import { Bell, Megaphone } from "lucide-react";
import type { InboxMessage } from "@/lib/notifications/inbox-rules";
import { readNotification } from "@/lib/portal/inbox-actions";

const dateFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
export function InboxMessages({ messages, empty }: { messages: InboxMessage[]; empty: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return <div className="portal-inbox-list">
    {error && <p className="portal-form-error" role="alert">{error}</p>}
    {!messages.length && <div className="portal-card"><p className="portal-empty">{empty}</p></div>}
    {messages.map((message) => <article key={message.id} id={`message-${message.id}`} className={`portal-card portal-inbox-message${message.readAt ? "" : " is-unread"}`}>
      <div className="portal-inbox-message-head">
        {message.kind === "announcement" ? <Megaphone size={20} aria-hidden="true" /> : <Bell size={20} aria-hidden="true" />}
        <div><p className="portal-eyebrow">{message.senderName}</p><h2>{message.title}</h2></div>
        {!message.readAt && <span className="portal-inbox-unread">Unread</span>}
      </div>
      <p className="portal-inbox-meta"><time dateTime={message.createdAt}>{dateFormat.format(new Date(message.createdAt))} PHT</time> · {message.audienceLabel}</p>
      <p className="portal-inbox-body">{message.body}</p>
      {!message.readAt && <button className="portal-button is-ghost" disabled={pending} onClick={() => startTransition(async () => {
        try {
          const result = await readNotification(message.id);
          setError(result.error);
          if (!result.error) window.dispatchEvent(new Event("portal-notifications-changed"));
        } catch { setError("Couldn’t mark this as read. Try again."); }
      })}>Mark as read</button>}
    </article>)}
  </div>;
}

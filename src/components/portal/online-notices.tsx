"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { CloseIcon as X } from "@/components/action-icons";
import { useOnline } from "./online-provider";
import { dismissToast, toastDuration, useToasts, type ToastItem } from "./toast";

/**
 * Bottom right of the screen: someone asking to follow, who you're following or who's following you
 * (each with a way to stop it), short updates such as a chat ending, and every action's "Saved" or
 * "Couldn't save" (toast.tsx). It's a popover, so it sits above an open dialog too. While the
 * drawer is open, requests are answered in the drawer instead.
 */
export function OnlineNotices() {
  const { session, notices, dismissNotice, accept, decline, stopFollowing, removeFollower } = useOnline();
  const toasts = useToasts();
  const stack = useRef<HTMLDivElement>(null);
  const requests = Object.values(session.requests);
  const followers = Object.values(session.followers);
  const count = requests.length + followers.length + (session.following ? 1 : 0) + notices.length + toasts.length;
  const newest = toasts.at(-1)?.id ?? 0;

  // Shown again whenever something new arrives, so it goes above a dialog, menu or profile card opened since.
  useLayoutEffect(() => {
    const element = stack.current;
    if (!element?.showPopover) return;
    if (!count) {
      if (element.matches(":popover-open")) element.hidePopover();
      return;
    }
    const open = element.matches(":popover-open");
    const above = [...document.querySelectorAll("dialog:modal, :fullscreen, :popover-open")].some((other) => other !== element);
    if (open && above) element.hidePopover();
    if (!element.matches(":popover-open")) element.showPopover();
  }, [count, newest, notices.length]);

  return <div ref={stack} popover="manual" className="portal-online-notices" role="region" aria-label="Notifications">
    {/* Newest first; the stack runs upward, so what was just done sits nearest the corner. */}
    {toasts.toReversed().map((item) => <ToastPill key={item.id} item={item} />)}
    {requests.map((contact) => <div key={contact.accountId} className="portal-online-notice is-request" role="alertdialog" aria-label={`${contact.name} wants to follow you`}>
      <p><strong>{contact.name}</strong> wants to follow you. They’ll be taken to each page you open, until either of you stops.</p>
      <span>
        <button type="button" className="portal-button is-small is-ghost" onClick={() => decline(contact.accountId)}>Decline</button>
        <button type="button" className="portal-button is-small" onClick={() => accept(contact.accountId)}>Allow</button>
      </span>
    </div>)}
    {session.following && <div className="portal-online-notice is-bar">
      <i aria-hidden="true" /><p>Following <strong>{session.following.name}</strong></p>
      <button type="button" className="portal-online-follow" onClick={stopFollowing}>Stop</button>
    </div>}
    {followers.map((contact) => <div key={contact.accountId} className="portal-online-notice is-bar">
      <i aria-hidden="true" /><p><strong>{contact.name}</strong> is following you</p>
      <button type="button" className="portal-online-follow" onClick={() => removeFollower(contact.accountId)}>Stop</button>
    </div>)}
    {notices.map((notice) => <div key={notice.id} className="portal-online-notice" role="status">
      <p>{notice.text}</p>
      <button type="button" className="portal-online-dismiss" aria-label="Dismiss" onClick={() => dismissNotice(notice.id)}><X size={14} aria-hidden="true" /></button>
    </div>)}
  </div>;
}

/** One action's pop-up: it goes by itself after a while, or when dismissed; hovering keeps it up. */
export function ToastPill({ item }: { item: ToastItem }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(() => dismissToast(item.id), toastDuration(item));
    return () => window.clearTimeout(timer);
  }, [held, item]);

  const Icon = item.tone === "ok" ? Check : AlertTriangle;
  return <div className={`portal-online-notice is-toast is-${item.tone}`} role={item.tone === "error" ? "alert" : "status"}
    onPointerEnter={() => setHeld(true)} onPointerLeave={() => setHeld(false)} onFocus={() => setHeld(true)} onBlur={() => setHeld(false)}>
    <span className="portal-toast-icon" aria-hidden="true"><Icon size={13} strokeWidth={2.4} /></span>
    <p>{item.message}</p>
    <button type="button" className="portal-online-dismiss" aria-label="Dismiss" onClick={() => dismissToast(item.id)}><X size={14} aria-hidden="true" /></button>
  </div>;
}

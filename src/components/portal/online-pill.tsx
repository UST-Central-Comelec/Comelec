"use client";

import { useOnline } from "./online-provider";

/**
 * The pill beside the bell: how many people have the portal open right now; on click, the drawer
 * with who, everyone seen in the last 24 hours, and chat. Shows unread messages and follow requests
 * as a count. Hidden until the first check-in answers, so it stays out of the way where the list is
 * unavailable (before its migration is run).
 */
export function OnlinePill() {
  const { people, isOnline, unread, session, drawerOpen, openDrawer } = useOnline();
  if (!people) return null;
  const online = people.filter(isOnline);
  // You check in yourself, so "no one online" means no one but you.
  const alone = !online.some((person) => !person.you);
  const waiting = unread + Object.keys(session.requests).length;
  const label = `${alone ? "You’re all alone" : `${online.length} online`}${waiting ? `, ${waiting} waiting for you` : ""}. Show who`;

  return <button type="button" className={`portal-online-pill${alone ? " is-alone" : ""}`} aria-label={label} aria-haspopup="dialog" aria-expanded={drawerOpen} onClick={() => openDrawer()}>
    <i aria-hidden="true" />{alone ? <em>You’re all alone</em> : <><b>{online.length}</b><span>online</span></>}
    {waiting > 0 && <strong className="portal-online-badge" aria-hidden="true">{waiting > 9 ? "9+" : waiting}</strong>}
  </button>;
}

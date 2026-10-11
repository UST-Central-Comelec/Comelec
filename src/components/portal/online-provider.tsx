"use client";

import { createClient } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CHECK_IN_MS, isPortalPath, type PresencePerson, type RealtimeInfo, type RelayEvent, type RelayKind } from "@/lib/portal/presence";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import { OnlineDrawer } from "./online-drawer";
import { OnlineNotices } from "./online-notices";

// Who's online, chat and following, for the whole portal: one check-in loop, one live connection
// and one drawer, shared by the topbar's pill and the phone header's.
//
// Nothing here is saved anywhere. Chats and follows live in this tab's memory, and end for both
// people as soon as either leaves the portal: closes it, signs out, or drops off for longer than a
// refresh takes. Messages and follow signals go through the server (online/relay), which says who
// sent them; each browser listens only on its own inbox, whose name only it and the server know.

export type Contact = Pick<PresencePerson, "accountId" | "id" | "name" | "role" | "avatarUrl">;
export type ChatMessage = { id: string; mine: boolean; text: string; at: string; failed?: boolean; senderName?: string };
type Chat = { contact: Contact; messages: ChatMessage[]; unread: number };
type Session = {
  chats: Record<string, Chat>;
  /** Who this person is following, once they accepted. */
  following: Contact | null;
  /** Asked to follow, waiting for an answer. */
  requested: Record<string, Contact>;
  /** Asking to follow this person. */
  requests: Record<string, Contact>;
  /** Following this person. */
  followers: Record<string, Contact>;
};
type Notice = { id: string; text: string };

const emptySession: Session = { chats: {}, following: null, requested: {}, requests: {}, followers: {} };

function scopeGroups(session: Session, unitKey: string): Session {
  const entries = Object.entries(session.chats).filter(([key]) => !key.startsWith("unit:") || key === unitKey);
  return entries.length === Object.keys(session.chats).length ? session : { ...session, chats: Object.fromEntries(entries) };
}

/** How long someone can be gone (a refresh, a dropped connection) before their chats and follows end. */
const LEAVE_GRACE_MS = 15_000;
/** A refresh within this long picks up this tab's chats where they were. */
const RESTORE_WINDOW_MS = 20_000;

const storageKey = (accountId: string) => `comelec:online:v2:${accountId}`;

/** This tab's chats and follows, if it was refreshed a moment ago. Read once, then forgotten. */
function restore(accountId: string): Session | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(accountId)) ?? "null") as { savedAt: number; session: Session } | null;
    sessionStorage.removeItem(storageKey(accountId));
    return saved && Date.now() - saved.savedAt < RESTORE_WINDOW_MS ? saved.session : null;
  } catch {
    return null;
  }
}

const contactOf = ({ accountId, id, name, role, avatarUrl }: Contact): Contact => ({ accountId, id, name, role, avatarUrl });
const without = <T,>(record: Record<string, T>, key: string) => {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
};

type RelayBody = { kind: RelayKind; to: string; text?: string; path?: string; messageId?: string };
async function relay(body: RelayBody): Promise<{ ok: true } | { ok: false; error: string; gone: boolean }> {
  try {
    const response = await fetch("/portal/online/relay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (response.ok) return { ok: true };
    const data = await response.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Couldn’t send. Try again shortly.", gone: response.status === 410 };
  } catch {
    return { ok: false, error: "Couldn’t send. Check your connection.", gone: false };
  }
}

type OnlineContext = {
  people: PresencePerson[] | null;
  unit: RealtimeInfo["unit"] | null;
  /** When the list was last loaded, for "12m ago". */
  checkedAt: number;
  /** Whether this tab is connected live, so chat and following work. */
  live: boolean;
  /** The live connection failed (it keeps retrying on its own). */
  down: boolean;
  /** Is this person here right now, and can they be messaged or followed? */
  reachable: (person: Pick<Contact, "id">) => boolean;
  isOnline: (person: PresencePerson) => boolean;
  session: Session;
  unread: number;
  notices: Notice[];
  dismissNotice: (id: string) => void;
  drawerOpen: boolean;
  /** The open chat in the drawer (an accountId), or null for the list. */
  view: string | null;
  setView: (accountId: string | null) => void;
  openDrawer: (view?: string | null) => void;
  send: (contact: Contact, text: string) => void;
  requestFollow: (contact: Contact) => void;
  cancelRequest: (accountId: string) => void;
  stopFollowing: () => void;
  accept: (accountId: string) => void;
  decline: (accountId: string) => void;
  removeFollower: (accountId: string) => void;
};

const Context = createContext<OnlineContext | null>(null);

export function useOnline() {
  const context = useContext(Context);
  if (!context) throw new Error("useOnline needs the OnlineProvider.");
  return context;
}

/** Reports the page and its query, inside Suspense since reading the query needs it. */
function RouteWatcher({ onRoute }: { onRoute: (route: string) => void }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  useEffect(() => onRoute(query ? `${pathname}?${query}` : pathname), [pathname, query, onRoute]);
  return null;
}

export function OnlineProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [people, setPeople] = useState<PresencePerson[] | null>(null);
  const [checkedAt, setCheckedAt] = useState(0);
  const [realtime, setRealtime] = useState<RealtimeInfo | null>(null);
  const [present, setPresent] = useState<ReadonlySet<string>>(new Set());
  const [live, setLive] = useState(false);
  const [down, setDown] = useState(false);
  const [session, setSession] = useState<Session>(emptySession);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const [route, setRoute] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const sessionRef = useRef(session);
  const routeRef = useRef(route);
  const viewRef = useRef({ drawerOpen, view });
  /** The page the followed person was last on; landing anywhere else means this person wandered off. */
  const expected = useRef<string | null>(null);
  const lastChecked = useRef(0);
  useEffect(() => { sessionRef.current = session; routeRef.current = route; viewRef.current = { drawerOpen, view }; });

  const notify = useCallback((text: string) => {
    const id = crypto.randomUUID();
    setNotices((current) => [...current.slice(-3), { id, text }]);
    window.setTimeout(() => setNotices((current) => current.filter((notice) => notice.id !== id)), 7000);
  }, []);
  const dismissNotice = useCallback((id: string) => setNotices((current) => current.filter((notice) => notice.id !== id)), []);

  // Check in once a minute, and straight away when someone new turns up live. The first answer
  // names this person's channels, and with them, where a refresh left this tab's chats.
  const checkNow = useRef<(force?: boolean) => void>(() => {});
  useEffect(() => {
    let restoredFor: string | null = null;
    const check = async (force = false) => {
      if (!force && Date.now() - lastChecked.current < 5_000) return;
      lastChecked.current = Date.now();
      try {
        const response = await fetch("/portal/online", { method: "POST", cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { people: PresencePerson[]; realtime: RealtimeInfo };
        setPeople(data.people);
        setCheckedAt(Date.now());
        setRealtime((current) => current && current.inbox === data.realtime.inbox && current.lobby === data.realtime.lobby && current.unit?.key === data.realtime.unit.key ? current : data.realtime);
        if (restoredFor !== data.realtime.accountId) {
          restoredFor = data.realtime.accountId;
          const saved = restore(data.realtime.accountId);
          setSession(saved ? scopeGroups(saved, data.realtime.unit.key) : emptySession);
          setView(null);
          expected.current = null;
        } else {
          setView((current) => current?.startsWith("unit:") && current !== data.realtime.unit.key ? null : current);
          setSession((current) => scopeGroups(current, data.realtime.unit.key));
        }
      } catch {
        // Keeps the last list; the next check-in tries again.
      }
    };
    checkNow.current = (force) => void check(force);
    void check(true);
    const timer = window.setInterval(() => void check(true), CHECK_IN_MS);
    const focused = () => void check();
    window.addEventListener("focus", focused);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", focused); };
  }, []);
  useEffect(() => {
    if (people && [...present].some((id) => !people.some((person) => person.id === id))) checkNow.current();
  }, [present, people]);

  // A refresh picks the chats back up (see restore); anything older, such as signing out and back
  // in, starts fresh.
  useEffect(() => {
    if (!realtime) return;
    const save = () => {
      try { sessionStorage.setItem(storageKey(realtime.accountId), JSON.stringify({ savedAt: Date.now(), session: sessionRef.current })); } catch { /* Not kept. */ }
    };
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [realtime]);

  const goTo = useCallback((path: string | undefined) => {
    if (!isPortalPath(path)) return;
    expected.current = path;
    if (routeRef.current !== path) router.push(path);
  }, [router]);

  const handle = useCallback((event: RelayEvent) => {
    if (!realtime) return;
    const mine = event.from.accountId === realtime.accountId;
    if (event.kind === "unit-chat") {
      if (event.to !== realtime.unit.key || !event.messageId || !event.text) return;
      const { drawerOpen: open, view: shown } = viewRef.current;
      const seen = open && shown === event.to;
      const message: ChatMessage = { id: event.messageId, mine, text: event.text, at: event.at, senderName: event.from.name };
      const contact: Contact = { accountId: realtime.unit.key, id: realtime.unit.key, name: realtime.unit.name, role: "Unit group chat", avatarUrl: null };
      setSession((current) => {
        const chat = current.chats[event.to];
        if (chat?.messages.some((item) => item.id === message.id)) return current;
        return { ...current, chats: { ...current.chats, [event.to]: { contact, messages: [...(chat?.messages ?? []), message], unread: (chat?.unread ?? 0) + (!mine && !seen ? 1 : 0) } } };
      });
      return;
    }
    if (mine) {
      // Your own message, from this tab or another of yours.
      if (event.kind !== "chat" || !event.messageId || !event.text) return;
      const { messageId, text, at } = event;
      setSession((current) => {
        const chat = current.chats[event.to];
        if (chat?.messages.some((message) => message.id === messageId)) return current;
        const contact = chat?.contact ?? people?.find((person) => person.accountId === event.to);
        if (!contact) return current;
        const messages = [...(chat?.messages ?? []), { id: messageId, mine: true, text, at }];
        return { ...current, chats: { ...current.chats, [event.to]: { contact: contactOf(contact), messages, unread: chat?.unread ?? 0 } } };
      });
      return;
    }
    const from = contactOf(event.from);
    const name = from.name || "Someone";
    switch (event.kind) {
      case "chat": {
        if (!event.text || !event.messageId) return;
        const { drawerOpen: open, view: shown } = viewRef.current;
        // Open on screen (even in a tab in the background, to be read on coming back) counts as read.
        const seen = open && shown === from.accountId;
        const message = { id: event.messageId, mine: false, text: event.text, at: event.at };
        setSession((current) => {
          const chat = current.chats[from.accountId];
          if (chat?.messages.some((item) => item.id === message.id)) return current;
          return { ...current, chats: { ...current.chats, [from.accountId]: { contact: from, messages: [...(chat?.messages ?? []), message], unread: (chat?.unread ?? 0) + (seen ? 0 : 1) } } };
        });
        return;
      }
      case "follow-request":
        setSession((current) => ({ ...current, requests: { ...current.requests, [from.accountId]: from } }));
        return;
      case "follow-accept": {
        if (!(from.accountId in sessionRef.current.requested)) return;
        const previous = sessionRef.current.following;
        if (previous && previous.accountId !== from.accountId) void relay({ kind: "follow-stop", to: previous.accountId });
        setSession((current) => ({ ...current, following: from, requested: without(current.requested, from.accountId) }));
        notify(`${name} accepted. You’ll be taken to each page they open.`);
        goTo(event.path);
        return;
      }
      case "follow-decline":
        setSession((current) => ({ ...current, requested: without(current.requested, from.accountId) }));
        notify(`${name} declined your request to follow.`);
        return;
      case "follow-stop": {
        const before = sessionRef.current;
        if (before.following?.accountId === from.accountId) { expected.current = null; notify(`${name} stopped letting you follow.`); }
        else if (from.accountId in before.followers) notify(`${name} stopped following you.`);
        setSession((current) => ({
          ...current,
          following: current.following?.accountId === from.accountId ? null : current.following,
          followers: without(current.followers, from.accountId),
          requests: without(current.requests, from.accountId),
          requested: without(current.requested, from.accountId),
        }));
        return;
      }
      case "path":
        if (sessionRef.current.following?.accountId === from.accountId) goTo(event.path);
        return;
    }
  }, [realtime, people, notify, goTo]);
  const handleRef = useRef(handle);
  useEffect(() => { handleRef.current = handle; });

  // The live connection: the lobby, to see who's here, and this person's own inbox.
  useEffect(() => {
    if (!realtime) return;
    const client = createClient(supabaseUrl, supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const lobby = client.channel(realtime.lobby, { config: { presence: { key: realtime.me } } });
    lobby.on("presence", { event: "sync" }, () => setPresent(new Set(Object.keys(lobby.presenceState()))))
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void lobby.track({ since: Date.now() });
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") setDown(status !== "SUBSCRIBED");
      });
    const inbox = client.channel(realtime.inbox)
      .on("broadcast", { event: "relay" }, ({ payload }) => handleRef.current(payload as RelayEvent))
      .subscribe();
    return () => {
      setLive(false);
      void client.removeChannel(lobby);
      void client.removeChannel(inbox);
    };
  }, [realtime]);

  // Someone gone for longer than a refresh: their chat and any following end.
  useEffect(() => {
    if (!live || !realtime || !present.has(realtime.me)) return;
    const timer = window.setTimeout(() => {
      const current = sessionRef.current;
      const gone = (contact: Contact) => contact.accountId.startsWith("unit:") ? contact.accountId !== realtime.unit.key : !present.has(contact.id);
      for (const chat of Object.values(current.chats)) {
        if (!chat.contact.accountId.startsWith("unit:") && gone(chat.contact) && chat.messages.length) notify(`${chat.contact.name} left the portal. Your chat has ended.`);
      }
      if (current.following && gone(current.following)) { expected.current = null; notify(`${current.following.name} left the portal. You’ve stopped following.`); }
      const keep = <T extends Contact>(record: Record<string, T>) => Object.fromEntries(Object.entries(record).filter(([, contact]) => !gone(contact)));
      setSession((latest) => ({
        chats: Object.fromEntries(Object.entries(latest.chats).filter(([, chat]) => !gone(chat.contact))),
        following: latest.following && gone(latest.following) ? null : latest.following,
        requested: keep(latest.requested),
        requests: keep(latest.requests),
        followers: keep(latest.followers),
      }));
    }, LEAVE_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [present, live, realtime, notify]);

  // Each page this person opens goes to their followers; landing anywhere but where the followed
  // person is means they went their own way, which stops the following.
  useEffect(() => {
    if (route === null) return;
    const { followers, following } = sessionRef.current;
    for (const follower of Object.values(followers)) void relay({ kind: "path", to: follower.accountId, path: route });
    if (following && expected.current !== null && route !== expected.current) {
      expected.current = null;
      void relay({ kind: "follow-stop", to: following.accountId });
      setSession((current) => ({ ...current, following: null }));
      notify(`You opened another page, so you stopped following ${following.name}.`);
    }
  }, [route, notify]);

  const send = useCallback((contact: Contact, text: string) => {
    const id = crypto.randomUUID();
    const message: ChatMessage = { id, mine: true, text, at: new Date().toISOString() };
    setSession((current) => {
      const chat = current.chats[contact.accountId];
      return { ...current, chats: { ...current.chats, [contact.accountId]: { contact: contactOf(contact), messages: [...(chat?.messages ?? []), message], unread: 0 } } };
    });
    void relay({ kind: contact.accountId.startsWith("unit:") ? "unit-chat" : "chat", to: contact.accountId, text, messageId: id }).then((result) => {
      if (result.ok) return;
      setSession((current) => {
        const chat = current.chats[contact.accountId];
        if (!chat) return current;
        return { ...current, chats: { ...current.chats, [contact.accountId]: { ...chat, messages: chat.messages.map((item) => item.id === id ? { ...item, failed: true } : item) } } };
      });
      notify(result.error);
    });
  }, [notify]);

  const requestFollow = useCallback((contact: Contact) => {
    setSession((current) => ({ ...current, requested: { ...current.requested, [contact.accountId]: contactOf(contact) } }));
    void relay({ kind: "follow-request", to: contact.accountId }).then((result) => {
      if (result.ok) return;
      setSession((current) => ({ ...current, requested: without(current.requested, contact.accountId) }));
      notify(result.error);
    });
  }, [notify]);

  const cancelRequest = useCallback((accountId: string) => {
    setSession((current) => ({ ...current, requested: without(current.requested, accountId) }));
    void relay({ kind: "follow-stop", to: accountId });
  }, []);

  const stopFollowing = useCallback(() => {
    const following = sessionRef.current.following;
    if (!following) return;
    expected.current = null;
    setSession((current) => ({ ...current, following: null }));
    void relay({ kind: "follow-stop", to: following.accountId });
  }, []);

  const accept = useCallback((accountId: string) => {
    const contact = sessionRef.current.requests[accountId];
    if (!contact) return;
    setSession((current) => ({ ...current, requests: without(current.requests, accountId), followers: { ...current.followers, [accountId]: contact } }));
    void relay({ kind: "follow-accept", to: accountId, path: routeRef.current ?? "/portal" }).then((result) => {
      if (result.ok) return;
      setSession((current) => ({ ...current, followers: without(current.followers, accountId) }));
      notify(result.error);
    });
  }, [notify]);

  const decline = useCallback((accountId: string) => {
    setSession((current) => ({ ...current, requests: without(current.requests, accountId) }));
    void relay({ kind: "follow-decline", to: accountId });
  }, []);

  const removeFollower = useCallback((accountId: string) => {
    setSession((current) => ({ ...current, followers: without(current.followers, accountId) }));
    void relay({ kind: "follow-stop", to: accountId });
  }, []);

  /** Opens a chat (an accountId) or the list. Opening a chat marks it read. */
  const show = useCallback((next: string | null) => {
    setView(next);
    if (next) setSession((current) => current.chats[next]?.unread ? { ...current, chats: { ...current.chats, [next]: { ...current.chats[next], unread: 0 } } } : current);
  }, []);

  // Opening is tracked here, and closing by the dialog's close event: React doesn't pass on a
  // dialog's toggle event.
  const opener = useRef<HTMLElement | null>(null);
  const openDrawer = useCallback((next: string | null = null) => {
    show(next);
    if (dialog.current?.open) return;
    opener.current = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    setDrawerOpen(true);
  }, [show]);
  const closed = useCallback(() => {
    setDrawerOpen(false);
    opener.current?.focus();
  }, []);

  const value = useMemo<OnlineContext>(() => ({
    people,
    unit: realtime?.unit ?? null,
    checkedAt,
    live,
    down,
    reachable: (person) => live && present.has(person.id) && person.id !== realtime?.me,
    isOnline: (person) => person.online || present.has(person.id),
    session,
    unread: Object.values(session.chats).reduce((total, chat) => total + chat.unread, 0),
    notices,
    dismissNotice,
    drawerOpen,
    view,
    setView: show,
    openDrawer,
    send,
    requestFollow,
    cancelRequest,
    stopFollowing,
    accept,
    decline,
    removeFollower,
  }), [people, checkedAt, live, down, present, realtime, session, notices, dismissNotice, drawerOpen, view, show, openDrawer, send, requestFollow, cancelRequest, stopFollowing, accept, decline, removeFollower]);

  return <Context value={value}>
    {children}
    <Suspense fallback={null}><RouteWatcher onRoute={setRoute} /></Suspense>
    <OnlineDrawer dialog={dialog} onClosed={closed} />
    <OnlineNotices />
  </Context>;
}

"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Search, MessageSquare, Pin, Users, X } from "lucide-react";
import { matchesPresenceSearch, MESSAGE_MAX, type PresencePerson } from "@/lib/portal/presence";
import { useOnline, type Contact } from "./online-provider";
import { OnlineProfile } from "./online-profile";

const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
const clockFormat = new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** "Just now", "12m ago", "13h ago": the list only goes back a day, so hours are enough. */
function lastSeen(at: string, now: number) {
  const minutes = Math.floor((now - Date.parse(at)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function Avatar({ person, online }: { person: Pick<Contact, "name" | "avatarUrl">; online?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className="portal-online-avatar">
    {person.avatarUrl && !failed
      // eslint-disable-next-line @next/next/no-img-element -- Google already serves a sized avatar.
      ? <img src={person.avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span aria-hidden="true">{person.name.trim().charAt(0).toUpperCase() || "?"}</span>}
    {online && <i aria-hidden="true" />}
  </span>;
}

/** Message and Follow, for someone here right now. */
function Actions({ person }: { person: PresencePerson }) {
  const { session, openDrawer, requestFollow, cancelRequest, stopFollowing } = useOnline();
  const unread = session.chats[person.accountId]?.unread ?? 0;
  const following = session.following?.accountId === person.accountId;
  const requested = person.accountId in session.requested;
  return <span className="portal-online-actions">
    <button type="button" className="portal-online-action" aria-label={`Message ${person.name}${unread ? `, ${unread} unread` : ""}`} title="Message" onClick={() => openDrawer(person.accountId)}>
      <MessageSquare size={14} aria-hidden="true" />{unread > 0 && <b>{unread}</b>}
    </button>
    {following
      ? <button type="button" className="portal-online-follow is-on" title="Stop following" onClick={stopFollowing}>Following</button>
      : requested
        ? <button type="button" className="portal-online-follow is-pending" title="Cancel the request" onClick={() => cancelRequest(person.accountId)}>Requested</button>
        : <button type="button" className="portal-online-follow" title={`Ask to follow ${person.name} to the pages they open`} onClick={() => requestFollow(person)}>Follow</button>}
  </span>;
}

function Person({ person, now }: { person: PresencePerson; now: number }) {
  const { reachable, isOnline } = useOnline();
  const online = isOnline(person);
  return <li className={online ? "is-online" : undefined}>
    <OnlineProfile accountId={person.accountId} name={person.name}>
    <Avatar person={person} online={online} />
    <span className="portal-online-copy">
      <strong>{person.name}{person.you && <small> (you)</small>}</strong>
      {person.role && <span>{person.role}</span>}
    </span>
    </OnlineProfile>
    {reachable(person) && !person.you
      ? <Actions person={person} />
      : online
        ? <span className="portal-online-when is-now">Online</span>
        : <time className="portal-online-when" dateTime={person.lastSeenAt} title={`${timeFormat.format(new Date(person.lastSeenAt))} PHT`}>{lastSeen(person.lastSeenAt, now)}</time>}
  </li>;
}

/** People asking to follow, answered here while the drawer covers the page's own prompts. */
function Requests({ search }: { search: string }) {
  const { people, session, accept, decline } = useOnline();
  const requests = Object.values(session.requests).filter((contact) => {
    const person = people?.find((person) => person.accountId === contact.accountId);
    return person ? matchesPresenceSearch(person, search) : !search.trim();
  });
  if (!requests.length) return null;
  return <>
    <h3>Asking to follow you <span>{requests.length}</span></h3>
    <ul>{requests.map((contact) => <li key={contact.accountId} className="portal-online-request">
      <OnlineProfile accountId={contact.accountId} name={contact.name}>
      <Avatar person={contact} online />
      <span className="portal-online-copy"><strong>{contact.name}</strong><span>Wants to follow you</span></span>
      </OnlineProfile>
      <span className="portal-online-actions">
        <button type="button" className="portal-online-follow" onClick={() => decline(contact.accountId)}>Decline</button>
        <button type="button" className="portal-online-follow is-on" onClick={() => accept(contact.accountId)}>Allow</button>
      </span>
    </li>)}</ul>
  </>;
}

function PeopleSearch({ search, onSearchChange, dialog }: { search: string; onSearchChange: (value: string) => void; dialog: RefObject<HTMLDialogElement | null> }) {
  const { people, unit } = useOnline();
  const id = useId();
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchPanel = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPosition, setSearchPosition] = useState({ left: 12, top: 110 });
  const suggestedUnits = [...new Map((people ?? []).map((person) => [person.unit.key, person.unit])).values()]
    .filter((suggestedUnit) => suggestedUnit.key !== unit?.key)
    .sort((a, b) => a.name.localeCompare(b.name));
  const suggestions = unit ? [unit, ...suggestedUnits] : suggestedUnits;
  const closeSearch = () => searchPanel.current?.hidePopover();
  const placeSearch = () => {
    const box = searchTrigger.current?.getBoundingClientRect();
    if (!box || searchPanel.current?.matches(":popover-open")) return;
    const width = Math.min(420, window.innerWidth - 24);
    const edge = dialog.current?.getBoundingClientRect().left ?? box.left;
    setSearchPosition({ left: Math.max(12, edge - width - 32), top: Math.max(12, Math.min(box.top, window.innerHeight - 360)) });
  };
  useEffect(() => {
    const drawer = dialog.current;
    const dismissSearch = () => searchPanel.current?.hidePopover();
    drawer?.addEventListener("close", dismissSearch);
    window.addEventListener("resize", dismissSearch);
    return () => { drawer?.removeEventListener("close", dismissSearch); window.removeEventListener("resize", dismissSearch); };
  }, [dialog]);
  return <>
    <button ref={searchTrigger} type="button" className="portal-online-close portal-online-search-toggle" popoverTarget={id} aria-label="Search" aria-haspopup="dialog" aria-expanded={searchOpen} aria-controls={id} title="Search" onClick={placeSearch}>
      <Search size={14} aria-hidden="true" />{search.trim() && <i aria-hidden="true" />}
    </button>
    <div ref={searchPanel} id={id} popover="auto" role="dialog" aria-label="Search" className="portal-online-search-settings" style={{ ...searchPosition, maxHeight: `calc(100dvh - ${searchPosition.top + 12}px)` }} onToggle={(event) => setSearchOpen(event.newState === "open")}>
      <div className="portal-online-search-heading"><strong>Search</strong><button type="button" aria-label="Close search" onClick={closeSearch}><X size={14} aria-hidden="true" /></button></div>
      {searchOpen && <><label htmlFor={`${id}-search`} className="portal-online-search-label">Name, unit or faculty/college</label>
        <input ref={searchInput} id={`${id}-search`} type="search" className="portal-online-search-input" placeholder="Full name or abbreviation (e.g. CICS)" value={search} onChange={(event) => onSearchChange(event.target.value)} maxLength={120} autoComplete="off" autoFocus />
        {suggestions.length > 0 && <><span id={`${id}-suggestions`} className="portal-online-search-label">Suggested searches</span>
          <div className="portal-online-search-suggestions" role="group" aria-labelledby={`${id}-suggestions`}>
            {suggestions.map((suggestedUnit) => <button type="button" key={suggestedUnit.key} onClick={() => { onSearchChange(suggestedUnit.name); searchInput.current?.focus(); }}><span>{suggestedUnit.name}</span>{suggestedUnit.key === unit?.key && <small>Your unit</small>}</button>)}
          </div>
        </>}
        {search.trim() && <button type="button" className="portal-online-search-clear" onClick={() => { onSearchChange(""); searchInput.current?.focus(); }}>Clear search</button>}
      </>}
    </div>
  </>;
}

function List({ search }: { search: string }) {
  const { people, unit, session, openDrawer, isOnline, checkedAt: now, down } = useOnline();
  if (!people) return <p className="portal-online-offline" role="status">Loading people…</p>;
  const searchResults = people.filter((person) => !person.you && matchesPresenceSearch(person, search));
  const online = searchResults.filter(isOnline);
  const earlier = searchResults.filter((person) => !isOnline(person));
  const unread = unit ? session.chats[unit.key]?.unread ?? 0 : 0;
  return <div className="portal-online-list">
    <div className="portal-online-list-top">
      {unit && <button type="button" className="portal-online-unit-chat" onClick={() => openDrawer(unit.key)}>
        <span className="portal-online-unit-icon"><Users size={20} aria-hidden="true" /></span>
        <span className="portal-online-copy"><strong>{unit.name}</strong><span>Unit group chat</span></span>
        {unread > 0 && <b className="portal-online-group-unread">{unread}</b>}
        <Pin size={14} aria-label="Pinned" />
      </button>}
    </div>
    <div className="portal-online-list-scroll">
      <Requests search={search} />
      <h3>Online now <span>{online.length}</span></h3>
      <ul>{online.map((person) => <Person key={person.accountId} person={person} now={now} />)}</ul>
      {!searchResults.length && search.trim() && <p className="portal-online-offline" role="status">No people match your search.</p>}
      {earlier.length > 0 && <><h3>Last 24 hours <span>{earlier.length}</span></h3>
        <ul>{earlier.map((person) => <Person key={person.accountId} person={person} now={now} />)}</ul></>}
      {down && <p className="portal-online-offline">Chat and Mirror Mode are unavailable right now. They come back on their own.</p>}
    </div>
  </div>;
}

function SelfProfile() {
  const { people, checkedAt } = useOnline();
  const me = people?.find((person) => person.you);
  if (!me) return null;
  return <footer className="portal-online-self" aria-label="Your profile">
    <ul><Person person={me} now={checkedAt} /></ul>
  </footer>;
}

function Conversation({ accountId }: { accountId: string }) {
  const { people, unit, live, session, reachable, setView, send } = useOnline();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const chat = session.chats[accountId];
  const group = unit?.key === accountId;
  const contact: Contact | undefined = group
    ? { accountId, id: accountId, name: unit.name, role: "Unit group chat", avatarUrl: null }
    : chat?.contact ?? people?.find((person) => person.accountId === accountId);
  const here = group ? live : contact ? reachable(contact) : false;
  const count = chat?.messages.length ?? 0;

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [count]);
  useEffect(() => { field.current?.focus(); }, [accountId]);

  if (!contact) return null;
  const submit = () => {
    const text = draft.trim();
    if (!text || !here) return;
    send(contact, text);
    setDraft("");
  };

  return <div className="portal-online-chat">
    <div className="portal-online-chat-head">
      <button type="button" className="portal-online-back" aria-label="Back to who’s online" title="Back" onClick={() => setView(null)}><ChevronLeft size={16} aria-hidden="true" /></button>
      {group ? <><span className="portal-online-unit-icon"><Users size={20} aria-hidden="true" /></span><span className="portal-online-copy"><strong>{contact.name}</strong><span>Unit group chat</span></span></> : <OnlineProfile accountId={contact.accountId} name={contact.name}>
        <Avatar person={contact} online={here} />
        <span className="portal-online-copy"><strong>{contact.name}</strong><span>{here ? contact.role : "Left the portal"}</span></span>
      </OnlineProfile>}
    </div>
    <div className="portal-online-messages" aria-live="polite">
      <p className="portal-online-ephemeral">{group ? "Messages are temporary and delivered to online members of your unit. They clear when you leave the portal." : "Messages aren’t saved. They disappear when either of you leaves the portal."}</p>
      {chat?.messages.map((message) => <div key={message.id} className={`portal-online-message${message.mine ? " is-mine" : ""}${message.failed ? " is-failed" : ""}`}>
        {group && !message.mine && <strong className="portal-online-message-author">{message.senderName}</strong>}
        <p>{message.text}</p>
        <time dateTime={message.at}>{message.failed ? "Not sent" : clockFormat.format(new Date(message.at))}</time>
      </div>)}
      {!here && <p className="portal-online-ended">{group ? "Connecting to the unit group…" : `${contact.name} isn’t in the portal now, so this chat has ended.`}</p>}
      <div ref={end} />
    </div>
    <form className="portal-online-compose" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <textarea ref={field} rows={1} value={draft} maxLength={MESSAGE_MAX} disabled={!here} placeholder={here ? `Message ${contact.name.split(" ")[0]}` : "Chat ended"} aria-label={`Message ${contact.name}`}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} />
      <button type="submit" className="portal-online-send" aria-label="Send message" disabled={!here || !draft.trim()}><ArrowUp size={16} aria-hidden="true" /></button>
    </form>
  </div>;
}

/**
 * The drawer from the right: who's online and who's been on, or one chat. A dialog sits above
 * everything, so it isn't held inside the header's blurred bar. It slides back out before closing;
 * straight away for reduced motion.
 */
export function OnlineDrawer({ dialog, onClosed }: { dialog: RefObject<HTMLDialogElement | null>; onClosed: () => void }) {
  const { view } = useOnline();
  const [search, setSearch] = useState("");

  const close = () => {
    const drawer = dialog.current;
    if (!drawer?.open || drawer.classList.contains("is-closing")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return drawer.close();
    drawer.classList.add("is-closing");
    drawer.addEventListener("animationend", function done(event) {
      if (event.target !== drawer) return;
      drawer.removeEventListener("animationend", done);
      drawer.classList.remove("is-closing");
      drawer.close();
    });
  };

  return <dialog ref={dialog} className="portal-online-drawer" aria-label={view ? "Chat" : "Who’s online"}
    onClose={() => { setSearch(""); onClosed(); }}
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className={`portal-online-drawer-body${view ? " is-chat" : ""}`} tabIndex={-1} autoFocus>
      {view ? <Conversation key={view} accountId={view} /> : <List search={search} />}
      {!view && <SelfProfile />}
    </div>
    {/* On the drawer's edge, like the main sidebar's collapse button. Outside the scrolling body so it isn't clipped, and after it so opening focuses the list, not this. */}
    <button type="button" className="portal-online-close" aria-label="Hide who’s online" title="Hide" onClick={close}><ChevronRight size={14} strokeWidth={2.2} aria-hidden="true" /></button>
    {!view && <PeopleSearch search={search} onSearchChange={setSearch} dialog={dialog} />}
  </dialog>;
}

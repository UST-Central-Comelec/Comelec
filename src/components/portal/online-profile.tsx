"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, MessageSquare, Monitor } from "lucide-react";
import { CopyIcon as Copy, CloseIcon as X } from "@/components/action-icons";
import type { PresenceProfile } from "@/lib/portal/presence";
import { useOnline } from "./online-provider";
import { toast } from "./toast";

function ProfilePicture({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  return <div className="portal-online-profile-picture">
    {url && !failed
      // eslint-disable-next-line @next/next/no-img-element -- Uses the Google avatar already validated at sign-in.
      ? <img src={url} alt={`${name}’s profile picture`} width={56} height={56} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span aria-label={`${name}’s initials`}>{name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase() || "?"}</span>}
  </div>;
}

type ProfileResult = { profile?: PresenceProfile; error?: string };

/** Profiles barely change, so reopening one (or hovering down the list and back) shows it at once. */
const PROFILE_FRESH_MS = 60_000;
const profileCache = new Map<string, { result: ProfileResult; at: number }>();
const profileRequests = new Map<string, Promise<ProfileResult>>();

const cachedProfile = (accountId: string) => profileCache.get(accountId)?.result ?? null;

/** One request per person at a time; hover, focus and opening all share it. */
function loadProfile(accountId: string): Promise<ProfileResult> {
  const cached = profileCache.get(accountId);
  if (cached && Date.now() - cached.at < PROFILE_FRESH_MS) return Promise.resolve(cached.result);
  const pending = profileRequests.get(accountId);
  if (pending) return pending;
  const request = fetch(`/portal/online/profile?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" })
    .then(async (response): Promise<ProfileResult> => {
      const data = await response.json();
      if (!response.ok) return { error: data.error ?? "Profile unavailable." };
      profileCache.set(accountId, { result: { profile: data }, at: Date.now() });
      return { profile: data };
    })
    .catch(() => cachedProfile(accountId) ?? { error: "Couldn’t load this profile." })
    .finally(() => profileRequests.delete(accountId));
  profileRequests.set(accountId, request);
  return request;
}

/** Native popover stays above the modal drawer and outside its scrolling list. */
export function OnlineProfile({ accountId, name, children }: { accountId: string; name: string; children: ReactNode }) {
  const { people, reachable, openDrawer, session, requestFollow, cancelRequest, stopFollowing } = useOnline();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoringFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");

  const cancelClose = () => { if (timer.current) clearTimeout(timer.current); };
  const hide = () => { cancelClose(); panel.current?.hidePopover(); };
  const closeAndFocus = () => {
    restoringFocus.current = true;
    hide();
    trigger.current?.focus({ preventScroll: true });
    restoringFocus.current = false;
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!panel.current?.contains(document.activeElement) && document.activeElement !== trigger.current) hide();
    }, 180);
  };
  const show = () => {
    cancelClose();
    const button = trigger.current;
    if (!button || panel.current?.matches(":popover-open")) return;
    const box = button.getBoundingClientRect();
    const edge = button.closest("dialog")?.getBoundingClientRect().left ?? box.left;
    const width = Math.min(420, window.innerWidth - 24);
    // On phones the card sits over the sidebar, within the viewport.
    setPosition({ left: Math.max(12, edge - width - 32), top: Math.max(12, Math.min(box.top, window.innerHeight - 360)) });
    setResult(cachedProfile(accountId));
    void loadProfile(accountId);
    setCopyState("idle");
    panel.current?.showPopover();
  };

  useEffect(() => {
    if (!open) return;
    let current = true;
    void loadProfile(accountId).then((next) => { if (current) setResult(next); });
    const dismiss = (event: Event) => {
      if (event.type === "scroll" && event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    };
    window.addEventListener("resize", dismiss);
    const drawer = trigger.current?.closest("dialog");
    drawer?.addEventListener("close", dismiss);
    drawer?.addEventListener("scroll", dismiss, true);
    return () => {
      current = false;
      window.removeEventListener("resize", dismiss);
      drawer?.removeEventListener("close", dismiss);
      drawer?.removeEventListener("scroll", dismiss, true);
    };
  }, [open, accountId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const profile = result?.profile;
  const copyEmail = async () => {
    if (!profile) return;
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopyState("copied");
      toast("Email copied to clipboard.");
    } catch {
      setCopyState("idle");
      toast("Couldn’t copy. Select the email above to copy it manually.", "error");
    }
  };
  const person = people?.find((person) => person.accountId === accountId);
  const canMessage = person ? reachable(person) : false;
  const mirroring = session.following?.accountId === accountId;
  const mirrorRequested = accountId in session.requested;
  const toggleMirror = () => {
    if (mirroring) stopFollowing();
    else if (mirrorRequested) cancelRequest(accountId);
    else if (person && canMessage) requestFollow(person);
  };
  return <>
    <button ref={trigger} type="button" className="portal-online-person" aria-label={`View ${name}’s profile`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
      onPointerEnter={(event) => { if (event.pointerType === "mouse") show(); else void loadProfile(accountId); }} onPointerLeave={scheduleClose}
      onFocus={() => { if (!restoringFocus.current) show(); }} onBlur={scheduleClose} onClick={show}>{children}</button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label={`${name}’s profile`} className="portal-online-profile" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }}
      onToggle={(event) => setOpen(event.newState === "open")}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeAndFocus(); } }}
      onPointerEnter={cancelClose} onPointerLeave={scheduleClose} onFocus={cancelClose} onBlur={scheduleClose}>
      <button className="portal-online-profile-close" type="button" aria-label="Close profile" onClick={closeAndFocus}><X size={15} aria-hidden="true" /></button>
      {!result ? person ? <div className="portal-online-profile-content" aria-busy="true">
        <div className="portal-online-profile-header">
          <ProfilePicture key={person.avatarUrl} name={person.name} url={person.avatarUrl} />
          <div><h2>{person.name}</h2><p aria-label="Faculty/College">{person.college ?? "Faculty/College not provided"}</p></div>
        </div>
        <p className="portal-online-profile-status is-inline" role="status">Loading details…</p>
      </div> : <p className="portal-online-profile-status" role="status">Loading profile…</p> : result.error ? <p className="portal-online-profile-status" role="status">{result.error}</p> : profile && <>
        <div className="portal-online-profile-content">
          <div className="portal-online-profile-header">
            <ProfilePicture key={profile.avatarUrl} name={profile.name} url={profile.avatarUrl} />
            <div><h2>{profile.name}</h2><p aria-label="Faculty/College">{profile.college ?? "Faculty/College not provided"}</p></div>
          </div>
          <dl className="portal-online-profile-details">
            {[["Position", profile.position], ["Role", profile.role], ["Unit", profile.unit]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <dl className="portal-online-profile-contact"><div><dt>Email</dt><dd><span>{profile.email}</span><button type="button" className="portal-online-profile-copy" disabled={copyState === "copying"} aria-label={copyState === "copied" ? "Email copied" : "Copy email"} title={copyState === "copied" ? "Copied!" : "Copy email"} onClick={() => void copyEmail()}>{copyState === "copied" ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}</button></dd></div></dl>
          <div className="portal-online-profile-buttons">
            <button type="button" disabled={!canMessage} title={canMessage ? `Message ${profile.name}` : person?.you ? "This is your profile" : "Available when they’re online"} onClick={() => { hide(); openDrawer(accountId); }}><MessageSquare size={15} aria-hidden="true" />Message</button>
            <button type="button" className="is-secondary" aria-pressed={mirroring} disabled={!canMessage && !mirroring && !mirrorRequested} title={mirroring ? "Stop mirroring their portal pages" : mirrorRequested ? "Cancel your Mirror Mode request" : "Ask to mirror the portal pages they open"} onClick={toggleMirror}><Monitor size={15} aria-hidden="true" />{mirroring ? "Mirror Mode on" : mirrorRequested ? "Requested" : "Mirror Mode"}</button>
          </div>
        </div>
      </>}
    </div>
  </>;
}

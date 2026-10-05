"use client";

import Link from "next/link";
import { useAccountSwitchTransition } from "./account-switch-transition";
import { useActionState, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Check, DoorOpen, Ellipsis, House, Settings, UserRound } from "lucide-react";
import { logout, switchPortalAccount } from "@/lib/portal/auth-actions";
import { unitAbbreviations } from "@/lib/applications/options";
import { describeAffiliation, type AccountAffiliation } from "@/lib/data/types";
import { ThemeToggle } from "./portal-theme";

export type PortalMembership = { id: string; affiliation: AccountAffiliation; college: string | null; role: string };
type ProfileUser = { id: string; name: string; role: string; email: string; avatarUrl: string | null };

const membershipName = (account: PortalMembership) => account.affiliation === "local" && account.college
  ? `${unitAbbreviations[account.college] ?? account.college} Comelec`
  : describeAffiliation(account.affiliation, account.college);

/** A native popover handles outside clicks, Escape and returning focus to its profile trigger. */
export function ProfileMenu({ user, memberships }: { user: ProfileUser; memberships: PortalMembership[] }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({});
  const [state, switchAccount, pending] = useActionState(switchPortalAccount, undefined);
  useEffect(() => {
    if (state?.error && !pending) panel.current?.showPopover();
  }, [state, pending]);
  const transition = useAccountSwitchTransition();
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) wasPending.current = true;
    else if (wasPending.current) {
      wasPending.current = false;
      transition.cancel();
    }
  }, [pending, transition]);
  const active = memberships.find((account) => account.id === user.id);

  const toggle = () => {
    if (!panel.current || !trigger.current) return;
    if (panel.current.matches(":popover-open")) return;
    const box = trigger.current.getBoundingClientRect();
    const gap = 10;
    const width = Math.min(320, window.innerWidth - gap * 2);
    const above = box.top - gap * 2;
    const below = window.innerHeight - box.bottom - gap * 2;
    const upwards = above >= below;
    setPosition({
      width,
      left: Math.max(gap, Math.min(box.left, window.innerWidth - width - gap)),
      maxHeight: Math.max(100, upwards ? above : below),
      ...(upwards ? { bottom: window.innerHeight - box.top + gap } : { top: box.bottom + gap }),
    });
  };

  return (
    <>
      <button ref={trigger} className="portal-account portal-profile-trigger" type="button" popoverTarget={id} onClick={toggle} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} title="Open profile menu">
        <span className="portal-account-link">
          {user.avatarUrl && !avatarFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- Google already serves a sized avatar.
            <img className="portal-account-initial" src={user.avatarUrl} alt="" width={34} height={34} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} />
          ) : <span className="portal-account-initial" aria-hidden="true">{user.name.trim().charAt(0).toUpperCase() || "?"}</span>}
          <span className="portal-account-text"><strong>{user.name}</strong><small>{user.role}</small></span>
        </span>
        <span className="portal-profile-more" aria-hidden="true"><Ellipsis size={17} /></span>
      </button>
      <div ref={panel} id={id} popover="auto" role="dialog" aria-label="Profile menu" className="portal-profile-menu" style={position} onToggle={(event) => setOpen(event.newState === "open")}>
        <div className="portal-profile-header">
          <div><strong>{user.name}</strong><span>{user.email}</span>{active && <small>{membershipName(active)}</small>}</div>
          <Link href="/portal/account" className="portal-profile-settings" aria-label="My account settings" title="My account settings" onClick={() => panel.current?.hidePopover()}><Settings size={18} aria-hidden="true" /></Link>
        </div>
        {memberships.length > 1 && (
          <section className="portal-profile-memberships" aria-label="Switch account">
            <p>Switch account</p>
            {memberships.map((account) => {
              const current = account.id === user.id;
              return (
                <form action={switchAccount} key={account.id} onSubmit={() => { panel.current?.hidePopover(); transition.begin(account.id); }}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <button className={`portal-profile-membership${current ? " is-current" : ""}`} type="submit" disabled={pending || current} aria-current={current ? "true" : undefined}>
                    <span><strong>{membershipName(account)}</strong><small>{account.role}</small></span>
                    {current && <Check size={16} aria-hidden="true" />}
                  </button>
                </form>
              );
            })}
            {state?.error && <p className="portal-profile-message is-error" role="alert">{state.error}</p>}
          </section>
        )}
        <div className="portal-profile-actions">
          <Link href="/portal/account" onClick={() => panel.current?.hidePopover()}><span>My account</span><UserRound size={17} aria-hidden="true" /></Link>
          <div className="portal-profile-theme"><span>Theme</span><ThemeToggle /></div>
          <a href="/" target="_blank" rel="noreferrer" onClick={() => panel.current?.hidePopover()}><span>Website</span><House size={17} aria-hidden="true" /></a>
          <form action={logout}><button type="submit" disabled={pending}><span>Log out</span><DoorOpen size={17} aria-hidden="true" /></button></form>
        </div>
      </div>
    </>
  );
}

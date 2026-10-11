"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LockOpenIcon } from "./lock-open-icon";

const AccessNavigationContext = createContext<((href: string) => void) | null>(null);
export const useAccessNavigation = () => useContext(AccessNavigationContext);

export function UnsavedAccessGuard({ dirty, children }: { dirty: boolean; children: ReactNode }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const destination = useRef<string | null>(null);
  const leaving = useRef(false);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  const navigate = useCallback((href: string) => {
    const url = new URL(href, window.location.href);
    if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
    else window.location.assign(url.href);
  }, [router]);

  const requestNavigation = useCallback((href: string) => {
    if (!dirty || leaving.current) { navigate(href); return; }
    destination.current = href;
    dialog.current?.showModal();
    setOpen(true);
  }, [dirty, navigate]);

  useEffect(() => {
    if (!dirty) return;
    leaving.current = false;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (leaving.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href);
      if (!/^https?:$/.test(url.protocol)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.origin === window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      requestNavigation(url.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty, requestNavigation]);

  const cancel = () => { destination.current = null; dialog.current?.close(); };
  const leave = () => {
    const href = destination.current;
    if (!href) return;
    leaving.current = true;
    dialog.current?.close();
    navigate(href);
  };

  return <AccessNavigationContext.Provider value={requestNavigation}>
    {children}
    <dialog ref={dialog} className="portal-access-security-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onClose={() => { setOpen(false); destination.current = null; }}>
      <LockOpenIcon className="portal-access-security-icon" size={28} loop={open} aria-hidden="true" />
      <small>Access control</small>
      <h2 id={titleId}>Unsaved changes</h2>
      <p id={descriptionId}>Your access changes haven’t been saved. Leaving will discard them.</p>
      <div className="portal-access-security-actions">
        <button type="button" className="portal-button is-ghost" autoFocus onClick={cancel}>Cancel</button>
        <button type="button" className="portal-button" onClick={leave}>Leave</button>
      </div>
    </dialog>
  </AccessNavigationContext.Provider>;
}

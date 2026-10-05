"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ComelecLoadingScreen } from "@/components/comelec-loading-screen";

const AccountSwitchContext = createContext<{ begin: (accountId: string) => void; cancel: () => void } | null>(null);
type Switch = { targetId: string; complete: boolean };

/** Lives above the sidebar so the loading screen survives its replacement with the new account. */
export function AccountSwitchTransition({ accountId, children }: { accountId: string; children: ReactNode }) {
  const [switching, setSwitching] = useState<Switch | null>(null);
  if (switching && switching.targetId === accountId && !switching.complete) {
    setSwitching({ ...switching, complete: true });
  }
  const begin = useCallback((targetId: string) => setSwitching({ targetId, complete: false }), []);
  const cancel = useCallback(() => setSwitching((current) => current?.complete ? current : null), []);

  useEffect(() => {
    if (!switching?.complete) return;
    // Finish the last part of the bar, then leave the full bar visible before revealing the page.
    const timer = window.setTimeout(() => setSwitching(null), 350);
    return () => window.clearTimeout(timer);
  }, [switching?.complete]);

  return (
    <AccountSwitchContext value={{ begin, cancel }}>
      {children}
      {switching && typeof document !== "undefined" && createPortal(
        <ComelecLoadingScreen label="Switching Comelec account" message="Switching Account" progress complete={switching.complete} />,
        document.body,
      )}
    </AccountSwitchContext>
  );
}

export function useAccountSwitchTransition() {
  const context = useContext(AccountSwitchContext);
  if (!context) throw new Error("Account switching requires the portal transition provider.");
  return context;
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function ApplicationModal({ children, onClose, titleId }: { children: ReactNode; onClose: () => void; titleId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="portal-registrant-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button type="button" className="portal-icon-button is-light portal-registrant-close" aria-label="Close application details" autoFocus onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
      {children}
    </dialog>
  );
}

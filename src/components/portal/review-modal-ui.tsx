"use client";

import { useId, useRef, type ReactNode } from "react";
import { SlidingFilterButtons } from "./sliding-filters";
import { toast } from "./toast";

export function CopyableReviewFact({ label, children, copyValue }: { label: string; children: ReactNode; copyValue?: string }) {
  const answer = useRef<HTMLElement>(null);
  const answerId = useId();
  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? answer.current?.textContent ?? "");
      toast(`${label} copied to clipboard.`);
    } catch {
      toast(`Couldn’t copy ${label.toLowerCase()}. Try selecting and copying the text.`, "error");
    }
  }
  return <div className="portal-review-copy-fact" role="button" tabIndex={0} aria-label={`Copy ${label.toLowerCase()} to clipboard`} aria-describedby={answerId} title={`Copy ${label.toLowerCase()}`} onClick={() => void copy()} onKeyDown={event => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void copy(); }
  }}><dt>{label}</dt><dd ref={answer} id={answerId}>{children}</dd></div>;
}

export function ReviewModalDetailsGroup({ title, number, children }: {
  title: string;
  number: string;
  children: ReactNode;
}) {
  return (
    <section className="portal-registrant-group">
      <h3><span>{number}</span>{title}</h3>
      <dl className="portal-modal-facts">{children}</dl>
    </section>
  );
}

export function ReviewModalHeader({ titleId, name, date, reference, status, dateAside }: {
  titleId: string;
  name: string;
  date: string;
  reference: string;
  status?: ReactNode;
  dateAside?: ReactNode;
}) {
  return (
    <header className="portal-registrant-receipt-head">
      <div className="portal-registrant-heading">
        {status ? <div className="portal-modal-name-status"><h2 id={titleId}>{name}</h2>{status}</div> : <h2 id={titleId}>{name}</h2>}
        <div className="portal-registrant-meta"><span className="portal-registrant-date">{date}</span>{dateAside}</div>
      </div>
      <div className="portal-registrant-reference"><span>Reference code</span><strong>{reference}</strong></div>
    </header>
  );
}

export function ReviewModalToolbar<Key extends string>({ items, active, label, onChange, actions, children }: {
  items: { key: Key; label: ReactNode }[];
  active: Key;
  label: string;
  onChange: (key: Key) => void;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="portal-modal-view-switch">
      <SlidingFilterButtons items={items} active={active} label={label} onChange={onChange} />
      {actions && <div className="portal-modal-review-actions">{actions}</div>}
      {children}
    </div>
  );
}

export function ReviewModalFooter({ children, leading }: { children: ReactNode; leading?: ReactNode }) {
  return <footer className="portal-registrant-receipt-foot portal-modal-review-footer">{leading && <div className="portal-modal-review-leading">{leading}</div>}<div className="portal-registrant-actions">{children}</div></footer>;
}

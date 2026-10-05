"use client";

import type { ReactNode } from "react";
import { SlidingFilterButtons } from "./sliding-filters";

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

"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Mail } from "lucide-react";
import { CloseIcon as X } from "@/components/action-icons";
import type { DirectoryEntry } from "@/lib/data/types";
import { formatAccepted, type Declaration } from "@/lib/onboarding/documents";
import { MemberAvatar } from "./member-avatar";
import "./onboarding.css";

/**
 * What a card says under the name: the role, and the college where the group mixes colleges.
 * `profile` is what their profile shows: their details as rows, and the onboarding declarations
 * they accepted, with when.
 */
export type DirectoryCard = Pick<DirectoryEntry, "id" | "name" | "email" | "facebookUrl" | "photoUrl"> & { subtitle: string; manageable: boolean; profile: { rows: Array<[string, string]>; declarations: Declaration[] } };

function FacebookMark() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;
}

/**
 * One group of the Directory, as cards. They're read from Accounts, so there's nothing to edit on
 * the card itself: it links out to the person (Facebook, email), and the name opens their profile,
 * with the declarations they accepted when they joined. For whoever manages their account, the
 * profile links to it.
 */
export function DirectoryCards({ people }: { people: DirectoryCard[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<DirectoryCard | null>(null);

  const open = (person: DirectoryCard) => {
    setSelected(person);
    dialog.current?.showModal();
  };

  return (
    <>
      <ul className="portal-members">
        {people.map((person) => (
          <li key={person.id}>
            <div className="directory-entry">
              <MemberAvatar photoUrl={person.photoUrl} />
              <span>
                <strong title={person.name}><button type="button" className="directory-profile-open" onClick={() => open(person)} title={`View ${person.name}’s profile`}>{person.name}</button></strong>
                <small title={person.subtitle}>{person.subtitle}</small>
              </span>
              <span className="directory-links">
                {person.facebookUrl && <a href={person.facebookUrl} target="_blank" rel="noreferrer" title="Facebook profile" aria-label={`${person.name} on Facebook`}><FacebookMark /></a>}
                <a href={`mailto:${person.email}`} title={person.email} aria-label={`Email ${person.name}`}><Mail size={15} strokeWidth={1.8} aria-hidden="true" /></a>
              </span>
            </div>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} className="portal-help-dialog" aria-labelledby="directory-profile-title" onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}>
        {selected && (
          <div className="portal-help-card">
            <header className="portal-help-head">
              <div className="chamber-dialog-who">
                <MemberAvatar photoUrl={selected.photoUrl} />
                <span><h2 id="directory-profile-title">{selected.name}</h2><small className="portal-muted">{selected.subtitle}</small></span>
              </div>
              <button type="button" className="portal-icon-button is-light" onClick={() => dialog.current?.close()} aria-label="Close"><X size={16} /></button>
            </header>
            <dl className="directory-profile-facts">
              {selected.profile.rows.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{label === "Facebook" ? <a href={value} target="_blank" rel="noreferrer">{value.replace(/^https?:\/\/(www\.)?/, "")}</a> : label === "UST email" ? <a href={`mailto:${value}`}>{value}</a> : value}</dd>
                </div>
              ))}
            </dl>
            <section className="directory-profile-section">
              <h3>E-declarations</h3>
              {selected.profile.declarations.length ? (
                <ul className="portal-declarations">
                  {selected.profile.declarations.map((item) => <li key={item.key}><span>{item.title}</span><small>Accepted {formatAccepted(item.acceptedAt)} · v{item.version}</small></li>)}
                </ul>
              ) : (
                <p className="portal-muted">None on file. Accounts added by hand, or before onboarding asked for them, have none.</p>
              )}
            </section>
            {selected.manageable && (
              <footer className="portal-help-foot">
                <Link className="portal-button is-ghost" href={`/portal/accounts/${selected.id}`}>Manage account</Link>
              </footer>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}

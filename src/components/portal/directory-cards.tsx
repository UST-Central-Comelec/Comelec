import Link from "next/link";
import { Mail } from "lucide-react";
import type { DirectoryEntry } from "@/lib/data/types";
import { MemberAvatar } from "./member-avatar";

/** What a card says under the name: the role, and the college where the group mixes colleges. */
export type DirectoryCard = Pick<DirectoryEntry, "id" | "name" | "email" | "facebookUrl" | "photoUrl"> & { subtitle: string; manageable: boolean };

function FacebookMark() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>;
}

/**
 * One group of the Directory, as cards. They're read from Accounts, so there's nothing to edit on
 * the card itself: it links out to the person (Facebook, email) and, for whoever manages their
 * account, the name opens the account.
 */
export function DirectoryCards({ people }: { people: DirectoryCard[] }) {
  return (
    <ul className="portal-members">
      {people.map((person) => (
        <li key={person.id}>
          <div className="directory-entry">
            <MemberAvatar photoUrl={person.photoUrl} />
            <span>
              <strong title={person.name}>{person.manageable ? <Link href={`/portal/accounts/${person.id}`} title={`Manage ${person.name}’s account`}>{person.name}</Link> : person.name}</strong>
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
  );
}

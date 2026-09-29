"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { chamberRoles, type ChamberRole } from "@/lib/data/types";
import { setChamberRole } from "@/lib/portal/member-actions";
import { MemberAvatar } from "./member-avatar";

export type ChamberMember = { id: string; name: string; college: string; photoUrl: string | null; role: ChamberRole | null };

const choices: Array<{ role: ChamberRole | null; label: string; note: string }> = [
  { role: "primus", label: chamberRoles.primus, note: "Head of the chamber" },
  { role: "vicar", label: chamberRoles.vicar, note: "The Primus’s associate" },
  { role: null, label: "Member", note: "A chairperson in the chamber" },
];

/**
 * The Chamber of Chairpersons: every Local Comelec Chairperson, added automatically. Clicking a card
 * sets who is Primus and who is Vicar; there's one of each.
 */
export function ChamberGroup({ members }: { members: ChamberMember[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<ChamberMember | null>(null);
  const [role, setRole] = useState<ChamberRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = (member: ChamberMember) => {
    setSelected(member);
    setRole(member.role);
    setError(null);
    dialog.current?.showModal();
  };

  const save = () => {
    if (!selected) return;
    startTransition(async () => {
      const result = await setChamberRole(selected.id, role);
      if (result.error) return setError(result.error);
      dialog.current?.close();
      router.refresh();
    });
  };

  const holderOf = (target: ChamberRole) => members.find((member) => member.role === target && member.id !== selected?.id);

  return (
    <>
      <ul className="portal-members">
        {members.map((member) => (
          <li key={member.id}>
            <button type="button" className="directory-button" onClick={() => open(member)}>
              <MemberAvatar photoUrl={member.photoUrl} />
              <span><strong>{member.name}</strong><small>{member.college}</small></span>
              {member.role ? <span className={`portal-tag chamber-tag is-${member.role}`}>{chamberRoles[member.role]}</span> : <span className="portal-muted">Set role</span>}
            </button>
          </li>
        ))}
      </ul>

      <dialog ref={dialog} className="portal-help-dialog" aria-labelledby="chamber-role-title" onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}>
        {selected && (
          <div className="portal-help-card">
            <header className="portal-help-head">
              <div className="chamber-dialog-who">
                <MemberAvatar photoUrl={selected.photoUrl} />
                <span><h2 id="chamber-role-title">{selected.name}</h2><small className="portal-muted">Chairperson · {selected.college}</small></span>
              </div>
              <button type="button" className="portal-icon-button is-light" onClick={() => dialog.current?.close()} aria-label="Close"><X size={16} /></button>
            </header>
            <fieldset className="chamber-roles">
              <legend className="portal-field-label">Role in the chamber</legend>
              {choices.map((choice) => {
                const holder = choice.role ? holderOf(choice.role) : undefined;
                return (
                  <label key={choice.label} className={`chamber-role${role === choice.role ? " is-selected" : ""}`}>
                    <input type="radio" name="chamber-role" checked={role === choice.role} onChange={() => setRole(choice.role)} />
                    <span>
                      <strong>{choice.label}</strong>
                      <small>{holder ? `${choice.note}. Currently ${holder.name}, who becomes a member.` : `${choice.note}.`}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {error && <p className="portal-form-error" role="alert">{error}</p>}
            <footer className="portal-help-foot chamber-dialog-foot">
              <Link className="chamber-edit-link" href={`/portal/members/${selected.id}`}>Edit member details</Link>
              <button type="button" className="portal-button" onClick={save} disabled={pending || role === selected.role}>{pending ? "Saving…" : "Save role"}</button>
            </footer>
          </div>
        )}
      </dialog>
    </>
  );
}

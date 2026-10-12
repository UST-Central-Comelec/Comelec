"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { OVERWRITE_FIELD, STAMP_FIELD, type EditGuardInfo } from "@/lib/portal/edit-conflict";
import type { FormState } from "@/lib/portal/form";
import { InfoTip } from "./info-tip";
import { useOnlineIfAny } from "./online-provider";

// Two people editing the same record (src/lib/data/edit-guard.ts). `EditPresence` says who else
// has it open; `EditConflict` carries the form's stamp and, when someone else saved the same field
// first, asks which version to keep.

const listNames = (names: string[]) =>
  names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names[0]} and ${names.length - 1} others`;

/** "Maria Santos is also editing this", while anyone else has the same record open in an editor. */
export function EditPresence({ guard }: { guard?: EditGuardInfo }) {
  const online = useOnlineIfAny();
  const announce = online?.announceEditing;
  const record = guard?.record ?? null;
  useEffect(() => {
    if (!announce || !record) return;
    announce(record);
    return () => announce(null);
  }, [announce, record]);

  const others = record && online ? online.editorsOf(record) : [];
  if (!others.length) return null;
  return (
    <p className="portal-edit-presence" role="status">
      <span className="portal-tag is-gold">{listNames(others.map((person) => person.name))} {others.length === 1 ? "is" : "are"} also editing this</span>
      <InfoTip label="Editing at the same time">Saves are merged when you change different fields. If you both change the same field, whoever saves second chooses which version to keep.</InfoTip>
    </p>
  );
}

const listAll = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

const timeOf = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
};

/** The form's stamp, and the choice after a conflicting save. Goes inside the form. */
export function EditConflict({ guard, state }: { guard?: EditGuardInfo; state: FormState }) {
  const conflict = state?.conflict;
  // The version this person chose to save over. Only sent while it's still the latest conflict's.
  const [overwrite, setOverwrite] = useState("");
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (conflict) bar.current?.scrollIntoView({ block: "nearest" });
  }, [conflict]);
  if (!guard) return null;

  const saveMine = () => {
    if (!conflict) return;
    flushSync(() => setOverwrite(conflict.version));
    bar.current?.closest("form")?.requestSubmit();
  };
  const when = conflict ? timeOf(conflict.at) : "";
  const you = conflict?.by === "You";

  return (
    <>
      <input type="hidden" name={STAMP_FIELD} value={guard.stamp} />
      <input type="hidden" name={OVERWRITE_FIELD} value={conflict && overwrite === conflict.version ? overwrite : ""} />
      {conflict && (
        <div className="portal-edit-conflict" ref={bar} role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <div className="portal-edit-conflict-text">
            <strong>{you ? "You saved this in another tab" : `${conflict.by} saved this`}{when && ` at ${when}`}</strong>
            <span>
              {conflict.fields.length ? `You both changed ${listAll(conflict.fields)}. ` : ""}
              Your version is still here. Load theirs to start again from it, or save yours over it.
            </span>
          </div>
          <div className="portal-edit-conflict-actions">
            <button type="button" className="portal-button is-ghost is-small" onClick={() => window.location.reload()}>Load their version</button>
            <button type="button" className="portal-button is-danger-ghost is-small" onClick={saveMine}>Save mine over theirs</button>
          </div>
        </div>
      )}
    </>
  );
}

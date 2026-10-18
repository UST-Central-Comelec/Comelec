"use client";

import { startTransition, useActionState, useId, useState, useTransition, type FormEvent } from "react";
import { Undo2, UserPlus, Users } from "lucide-react";
import { Combobox } from "@/components/combobox";
import { DatePicker } from "@/components/portal/date-picker";
import { Dropdown } from "@/components/portal/dropdown";
import { useHydrated } from "@/components/portal/portal-form";
import { SlidingSegments } from "@/components/portal/sliding-filters";
import { toast, useToast } from "@/components/portal/toast";
import { cancelJoinRequest, joinPartyFromPortal } from "@/lib/party-portal/actions";
import type { JoinableParty } from "@/lib/party-portal/types";
import "./documents.css";
import { Busy } from "@/components/busy";

// The Political Party tab for an account that isn't in a party: ask to join one that's
// registering, or register a new one and be its contact person. The same rules as the
// Political Party Registration page, without signing up again.

const formatDate = (iso: string) => (iso ? new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "");
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

export function PartyJoin({ parties, units }: { parties: JoinableParty[]; /** Units taking registrations now: "central" or a college. */ units: Array<{ value: string; label: string }> }) {
  const [state, formAction, pending] = useActionState(joinPartyFromPortal, undefined);
  useToast(state?.error, "error", state);
  const errors = state?.fieldErrors ?? {};
  const [mode, setMode] = useState<"join" | "new">(parties.length || !units.length ? "join" : "new");
  const [joinName, setJoinName] = useState("");
  const [unit, setUnit] = useState(units.length === 1 ? units[0].value : "");
  const [establishedAt, setEstablishedAt] = useState("");
  const hydrated = useHydrated();
  const id = useId();
  const joining = parties.find((party) => party.name === joinName) ?? null;
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => formAction(form));
  };

  return (
    <form className="portal-card portal-form pp-join" onSubmit={onSubmit} noValidate>
      <SlidingSegments active={mode} role="radiogroup" aria-label="Join or register">
        <label className={`portal-segment${mode === "join" ? " is-selected" : ""}`}><input type="radio" name="mode" value="join" checked={mode === "join"} onChange={() => setMode("join")} /><Users size={15} aria-hidden="true" />Join a party</label>
        <label className={`portal-segment${mode === "new" ? " is-selected" : ""}`}><input type="radio" name="mode" value="new" checked={mode === "new"} onChange={() => setMode("new")} /><UserPlus size={15} aria-hidden="true" />Register a new party</label>
      </SlidingSegments>

      {mode === "join" ? (
        parties.length ? (
          <>
            <div className={`portal-field${errors.partyId ? " has-error" : ""}`}>
              <span className="portal-field-label" id={`${id}-join`}>Party</span>
              <Combobox name="joinParty" options={parties.map((party) => party.name)} value={joinName} onChange={setJoinName} placeholder="Type or pick your party" emptyText="No party by that name is registering. Check the spelling, or register a new party." required invalid={Boolean(errors.partyId)} labelledBy={`${id}-join`} />
              <input type="hidden" name="partyId" value={joining?.id ?? ""} />
              {errors.partyId && <span className="portal-field-error">{errors.partyId}</span>}
            </div>
            {joining && (
              <dl className="portal-details">
                <div><dt>Registering with</dt><dd>{joining.unit}</dd></div>
                <div><dt>Established</dt><dd>{formatDate(joining.establishedAt)}</dd></div>
                <div><dt>Headquarters</dt><dd>{joining.headquarters || "Not given"}</dd></div>
                <div><dt>Contact person</dt><dd>{joining.contactName || "Not named"}</dd></div>
              </dl>
            )}
            <p className="portal-muted">The party’s contact person approves who joins. You’ll see its documents once they do, and we’ll email you.</p>
          </>
        ) : <p className="portal-muted">No party is registering right now. Register a new one, or check back later.</p>
      ) : units.length ? (
        <div className="pp-join-grid">
          <label className={`portal-field is-wide${errors.partyName ? " has-error" : ""}`}>
            <span className="portal-field-label">Party name</span>
            <input className="portal-input" name="partyName" maxLength={120} autoComplete="off" required />
            {errors.partyName && <span className="portal-field-error">{errors.partyName}</span>}
          </label>
          <div className={`portal-field${errors.unit ? " has-error" : ""}`}>
            <span className="portal-field-label" id={`${id}-unit`}>Registering with</span>
            <Dropdown name="unit" options={units} value={unit} onChange={setUnit} placeholder="Choose a unit" required invalid={Boolean(errors.unit)} labelledBy={`${id}-unit`} />
            {errors.unit && <span className="portal-field-error">{errors.unit}</span>}
          </div>
          <div className={`portal-field${errors.establishedAt ? " has-error" : ""}`}>
            <span className="portal-field-label" id={`${id}-date`}>Date of establishment</span>
            <DatePicker name="establishedAt" value={establishedAt} max={today()} onChange={setEstablishedAt} required invalid={Boolean(errors.establishedAt)} label="Date of establishment" />
            {errors.establishedAt && <span className="portal-field-error">{errors.establishedAt}</span>}
          </div>
          <label className={`portal-field is-wide${errors.headquarters ? " has-error" : ""}`}>
            <span className="portal-field-label">Principal headquarters{unit !== "central" && " (optional)"}</span>
            <input className="portal-input" name="headquarters" maxLength={250} autoComplete="off" placeholder="Building and room" required={unit === "central"} />
            {errors.headquarters && <span className="portal-field-error">{errors.headquarters}</span>}
          </label>
          <p className="portal-muted is-wide">You’ll be its contact person: you approve who joins and endorse its candidates. Then upload its documents here.</p>
        </div>
      ) : <p className="portal-muted">No Comelec unit is taking party registrations right now. Watch the commission’s announcements.</p>}

      <div className="pp-review-actions">
        <button type="submit" className="portal-button" disabled={pending || !hydrated || (mode === "join" ? !parties.length : !units.length)}>
          {mode === "join" ? <Users size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
          {pending ? <Busy>Sending</Busy> : mode === "join" ? "Ask to join" : "Register party"}
        </button>
      </div>
    </form>
  );
}

/** Takes back a request to join that's still waiting. */
export function CancelJoinRequest() {
  const [pending, start] = useTransition();
  return (
    <button type="button" className="portal-button is-ghost is-small" disabled={pending} onClick={() => start(async () => {
      const result = await cancelJoinRequest();
      toast(result.error ?? result.ok ?? "Done.", result.error ? "error" : "ok");
    })}><Undo2 size={14} aria-hidden="true" />{pending ? <Busy>Taking back</Busy> : "Take back my request"}</button>
  );
}

"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AddIcon as Plus, CloseIcon as X } from "@/components/action-icons";
import { collaboratorUnits, type EventDetails } from "@/lib/events/options";

export function EventCollaborators({ initial, errors }: { initial: EventDetails; errors: Record<string, string> }) {
  const id = useId();
  const [units, setUnits] = useState((initial.collaborators ?? []).filter(unit => unit !== "central"));
  const [others, setOthers] = useState(initial.otherCollaborators ?? []);
  const selected = units.length + others.length;
  return <fieldset className="portal-form-section">
    <legend>Collaborators</legend>
    <details className="portal-collaborators-dropdown">
      <summary><span>{selected ? `${selected} collaborator${selected === 1 ? "" : "s"} selected` : "Select collaborating units"}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="portal-collaborators-checklist">
        {collaboratorUnits.filter(unit => unit.value !== "central").map(unit => <label className="portal-check" key={unit.value}>
          <input type="checkbox" name="collaborators" value={unit.value} checked={units.includes(unit.value)} onChange={event => setUnits(event.target.checked ? [...units, unit.value] : units.filter(value => value !== unit.value))} />
          <span>{unit.label}</span>
        </label>)}
        <label className="portal-check">
          <input type="checkbox" checked={others.length > 0} onChange={event => setOthers(event.target.checked ? [""] : [])} />
          <span>Others</span>
        </label>
      </div>
    </details>
    {errors.collaborators && <span className="portal-field-error">{errors.collaborators}</span>}
    {others.length > 0 && <div className="portal-collaborators-others">
      {others.map((name, index) => <div className="portal-collaborator-other" key={index}>
        <div className={`portal-field${index === 0 && errors.otherCollaborators ? " has-error" : ""}`}>
          <label className="portal-field-label" htmlFor={`${id}-organization-${index}`}>{others.length === 1 ? "Organization name" : `Organization name ${index + 1}`}</label>
          <div className="portal-collaborator-input">
            <input id={`${id}-organization-${index}`} name="otherCollaborators" placeholder="Type the organization name" value={name} maxLength={200} required aria-invalid={Boolean(index === 0 && errors.otherCollaborators)} aria-describedby={index === 0 && errors.otherCollaborators ? `${id}-organization-error` : undefined} onChange={event => setOthers(others.map((value, row) => row === index ? event.target.value : value))} />
            <button type="button" className="portal-icon-button" aria-label={`Remove organization ${index + 1}`} onClick={() => setOthers(others.filter((_, row) => row !== index))}><X size={15} aria-hidden="true" /></button>
          </div>
          {index === 0 && errors.otherCollaborators && <span id={`${id}-organization-error`} className="portal-field-error">{errors.otherCollaborators}</span>}
        </div>
      </div>)}
      {others.length < 20 && <button type="button" className="portal-button is-ghost" onClick={() => setOthers([...others, ""])}><Plus size={15} aria-hidden="true" />Add another organization</button>}
    </div>}
  </fieldset>;
}

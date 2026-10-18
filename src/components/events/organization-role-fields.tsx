"use client";

import { useEffect, useState } from "react";

const examples = [
  { position: "Chairperson", committee: "Executive Division" },
  { position: "Vice President for External Relations", committee: "External Relations" },
  { position: "Executive Associate", committee: "Finance" },
];

/** One clock keeps each position paired with its committee through typing and deletion. */
function useRolePlaceholders(active: boolean) {
  const [text, setText] = useState(examples[0]);
  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      if (!active || motion.matches || document.hidden) {
        setText(examples[0]);
        return;
      }
      let index = 0;
      let length = 0;
      let deleting = false;
      setText({ position: "", committee: "" });
      const tick = () => {
        const example = examples[index];
        const longest = Math.max(example.position.length, example.committee.length);
        length += 1;
        setText({
          position: example.position.slice(0, deleting ? Math.max(0, example.position.length - length) : length),
          committee: example.committee.slice(0, deleting ? Math.max(0, example.committee.length - length) : length),
        });
        let delay = deleting ? 35 : 65;
        if (length >= longest) {
          length = 0;
          if (deleting) {
            index = (index + 1) % examples.length;
            deleting = false;
            delay = 350;
          } else {
            deleting = true;
            delay = 1800;
          }
        }
        timer = setTimeout(tick, delay);
      };
      timer = setTimeout(tick, 300);
    };
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [active]);
  return text;
}

export function OrganizationRoleFields({ position, committee, onPositionChange, onCommitteeChange, positionError, committeeError, active }: {
  position: string;
  committee: string;
  onPositionChange: (value: string) => void;
  onCommitteeChange: (value: string) => void;
  positionError?: string;
  committeeError?: string;
  active: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const placeholders = useRolePlaceholders(active && !focused && (!position || !committee));
  return <>
    <label className={`ev-field is-6${positionError ? " has-error" : ""}`} data-field="organizationPosition">
      <span className="ev-field-label">Position</span>
      <input name="organizationPosition" required maxLength={120} value={position} onChange={event => onPositionChange(event.target.value)} placeholder={placeholders.position} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {positionError && <span className="ev-field-error">{positionError}</span>}
    </label>
    <label className={`ev-field is-6${committeeError ? " has-error" : ""}`} data-field="organizationCommittee">
      <span className="ev-field-label">Committee/Department<em>Optional</em></span>
      <input name="organizationCommittee" maxLength={120} value={committee} onChange={event => onCommitteeChange(event.target.value)} placeholder={placeholders.committee} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {committeeError && <span className="ev-field-error">{committeeError}</span>}
    </label>
  </>;
}

"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { StudentGovernment } from "./student-government";

const views = [
  { key: "comet", label: "COMET Initiative" },
  { key: "government", label: "Student Government" },
] as const;

/** The switcher selects the entire landing page; COMET stays mounted to retain its animations. */
export function HomeViews({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState(0);

  function move(event: KeyboardEvent<HTMLButtonElement>) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") next = 1 - selected;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    setSelected(next);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }

  return (
    <div className="lp-home-views">
      <div className="lp-view-nav">
        <div className="lp-content-switcher" role="tablist" aria-label="Explore UST">
          {views.map((view, index) => (
            <button type="button" role="tab" key={view.key} id={`hero-tab-${view.key}`}
              aria-selected={selected === index} aria-controls={`landing-${view.key}`}
              tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={move}>
              {view.label}
            </button>
          ))}
        </div>
      </div>
      <div className="lp-view-panel" id="landing-comet" role="tabpanel" aria-labelledby="hero-tab-comet" tabIndex={0} hidden={selected !== 0}>
        {children}
      </div>
      <div className="lp-view-panel" id="landing-government" role="tabpanel" aria-labelledby="hero-tab-government" tabIndex={0} hidden={selected !== 1}>
        <StudentGovernment />
      </div>
    </div>
  );
}

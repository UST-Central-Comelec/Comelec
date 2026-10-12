"use client";

import { useReducedMotion } from "motion/react";
import type { Mode } from "./event-form-editor";
import { List, GalleryHorizontalEnd } from "./portal-nav-icons";
import { SlidingFilterButtons } from "./sliding-filters";
import "./event-form-editor.css";

export function FormEditorViewToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const reducedMotion = useReducedMotion();
  return <div className="form-editor-view-toggle">
    <SlidingFilterButtons label="Editor view" active={mode} onChange={onChange} items={([
      { key: "forms", label: "Forms editor", icon: List },
      { key: "preview", label: "Preview form", icon: GalleryHorizontalEnd },
    ] as const).map(({ key, label, icon: Icon }) => {
      const active = mode === key && !reducedMotion;
      return { key, label: <><span className="form-editor-view-icon" aria-hidden="true"><Icon size={16} animate={active} loop={active} loopDelay={1400} /></span>{label}</> };
    })} />
  </div>;
}

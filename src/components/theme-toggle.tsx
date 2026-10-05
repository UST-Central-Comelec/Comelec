"use client";

import { Moon, Sun } from "lucide-react";
import styles from "./theme-toggle.module.css";

/** Shared appearance for the public site and portal's theme controls. */
export function ThemeToggleButton({ light, onToggle, className = "" }: { light: boolean; onToggle: (from: HTMLButtonElement) => void; className?: string }) {
  return (
    <button className={`${styles.toggle}${className ? ` ${className}` : ""}`} type="button" role="switch" aria-checked={light} aria-label="Light theme" title={light ? "Switch to dark theme" : "Switch to light theme"} onClick={(event) => onToggle(event.currentTarget)}>
      <Sun size={17} strokeWidth={2} aria-hidden="true" />
      <Moon size={17} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

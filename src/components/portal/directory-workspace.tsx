"use client";

import { DownloadIcon } from "@/components/lucide-animated/download";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileSpreadsheet, FileText, Table2, FileJson, UserCog } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { LayoutDashboard, PanelLeft } from "./portal-nav-icons";
import { SlidingFilters, type FilterItem } from "./sliding-filters";
import { toast } from "./toast";
import "./directory-database.css";

export const DirectoryFiltersContext = createContext<{
  unit: string; query: string; setUnit: (value: string) => void; setQuery: (value: string) => void;
} | null>(null);

const formats = [
  { key: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { key: "pdf", label: "PDF", icon: FileText },
  { key: "csv", label: "CSV", icon: Table2 },
  { key: "json", label: "JSON", icon: FileJson },
] as const;

export function DirectoryWorkspace({ view, items, manages, children }: { view: string; items: FilterItem[]; manages: boolean; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const [unit, setUnit] = useState(() => searchParams.get("unit") ?? "");
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const returnParams = new URLSearchParams();
  const college = searchParams.get("college");
  if (college) returnParams.set("college", college);
  if (view === "database") {
    returnParams.set("view", "database");
    if (unit) returnParams.set("unit", unit);
    if (query) returnParams.set("q", query);
  }
  const returnTo = `/portal/members${returnParams.size ? `?${returnParams}` : ""}`;
  const accountsHref = `/portal/accounts?${new URLSearchParams({ returnTo })}`;

  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: Event) => { if (!(event.target instanceof Node && panel.current?.contains(event.target))) panel.current?.hidePopover(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);

  const download = async (format: string) => {
    panel.current?.hidePopover();
    setPending(true);
    try {
      const params = new URLSearchParams({ format });
      if (view === "database") { if (unit) params.set("unit", unit); if (query) params.set("q", query); }
      const response = await fetch(`/portal/members/export?${params}`, { cache: "no-store" });
      if (!response.ok || response.redirected) throw new Error("Export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `ust-comelec-directory.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast("Directory downloaded.");
    } catch { toast("Couldn’t download the directory. Try again.", "error"); }
    finally { setPending(false); }
  };

  return <DirectoryFiltersContext value={{ unit, query, setUnit, setQuery }}>
    <div className="directory-view-toolbar">
      <SlidingFilters active={view} label="Directory views" items={items.map(item => {
        const Icon = item.key === "dashboard" ? LayoutDashboard : PanelLeft;
        const active = view === item.key && !reducedMotion;
        return { ...item, label: <><span className="directory-view-icon" aria-hidden="true"><Icon size={16} animation="default-loop" animate={active} /></span>{item.label}</> };
      })} />
      <div className="directory-view-actions">
        <button ref={button} type="button" className="portal-button is-ghost" disabled={pending} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => {
          if (open) { panel.current?.hidePopover(); return; }
          const rect = button.current!.getBoundingClientRect();
          const width = Math.min(260, window.innerWidth - 24);
          setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: rect.bottom + 6 });
          panel.current?.showPopover();
        }}><DownloadIcon size={15} aria-hidden="true" />{pending ? "Downloading…" : "Download"}<ChevronDown size={14} aria-hidden="true" /></button>
        {manages && <Link className="portal-button is-ghost" href={accountsHref}><UserCog size={15} strokeWidth={1.8} aria-hidden="true" />Manage accounts</Link>}
      </div>
      <div ref={panel} id={id} popover="auto" role="dialog" aria-label="Export options" className="directory-export-menu" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }} onToggle={event => setOpen(event.newState === "open")} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); panel.current?.hidePopover(); button.current?.focus(); }
      }}>
        <p>Export options</p>
        {formats.map(({ key, label, icon: Icon }, index) => <button key={key} type="button" className="portal-button is-ghost is-block" autoFocus={index === 0} disabled={pending} onClick={() => download(key)}><Icon size={16} aria-hidden="true" />{label}</button>)}
      </div>
    </div>
    {children}
  </DirectoryFiltersContext>;
}

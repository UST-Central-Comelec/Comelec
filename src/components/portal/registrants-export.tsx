"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FileSpreadsheet, FileText, Table2, FileJson } from "lucide-react";
import { DownloadIcon } from "@/components/lucide-animated/download";
import { toast } from "./toast";
import type { EventResponseRow } from "./event-responses-table";
import "./directory-database.css";

const formats = [
  { key: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { key: "pdf", label: "PDF", icon: FileText },
  { key: "csv", label: "CSV", icon: Table2 },
  { key: "json", label: "JSON", icon: FileJson },
] as const;
const columns = ["Reference", "Name", "Email", "Affiliation", "Student number", "Registration", "Attendance logged", "Evaluation answered", "Edit request", "Submitted at"];

export function RegistrantsExport({ rows, rsvp }: { rows: EventResponseRow[]; rsvp: boolean }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const close = (event: Event) => { if (!(event.target instanceof Node && panel.current?.contains(event.target))) panel.current?.hidePopover(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true); };
  }, [open]);

  async function download(format: string) {
    panel.current?.hidePopover();
    button.current?.focus();
    setPending(true);
    try {
      const values = rows.map(row => [rsvp ? row.rsvp?.reference_code ?? row.referenceCode : row.referenceCode, row.name, row.email, row.affiliationSummary, row.studentNumber ?? "", row.registered === false ? "RSVP only" : row.status === "waitlisted" ? "Waitlisted" : "Registered", row.attendanceConfirmedAt ? "Yes" : "No", row.evaluation ? "Yes" : "No", row.editRequests?.some(request => request.status === "pending") ? "Yes" : "No", rsvp && row.rsvp ? new Date(row.rsvp.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" }) : row.signedUp]);
      const response = await fetch("/portal/events/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, columns, rows: values }) });
      if (response.redirected) throw new Error("Sign in again, then export the data.");
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(typeof failure?.error === "string" ? failure.error : "Couldn’t export the data. Try again.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `event-${rsvp ? "rsvp-responses" : "registrants"}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast("Data exported.");
    } catch (error) { toast(error instanceof Error ? error.message : "Couldn’t export the data. Try again.", "error"); }
    finally { setPending(false); }
  }

  return <>
    <button ref={button} type="button" className="portal-icon-button" aria-label={pending ? "Exporting…" : "Export data"} title={pending ? "Exporting…" : "Export data"} disabled={pending || rows.length === 0} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => {
      if (open) { panel.current?.hidePopover(); return; }
      const rect = button.current!.getBoundingClientRect();
      const width = Math.min(260, window.innerWidth - 24);
      setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top: rect.bottom + 6 });
      panel.current?.showPopover();
    }}><DownloadIcon size={15} aria-hidden="true" /></button>
    <div ref={panel} id={id} popover="auto" role="dialog" aria-label="Export options" className="directory-export-menu" style={{ ...position, maxHeight: `calc(100dvh - ${position.top + 12}px)` }} onToggle={event => setOpen(event.newState === "open")} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); panel.current?.hidePopover(); button.current?.focus(); }
    }}>
      <p>Export options</p>
      {formats.map(({ key, label, icon: Icon }) => <button key={key} type="button" className="portal-button is-ghost is-block" disabled={pending} onClick={() => void download(key)}><Icon size={16} aria-hidden="true" />{label}</button>)}
    </div>
  </>;
}

"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { ViewIcon as Eye, HideIcon as EyeOff } from "@/components/action-icons";
import { formatAccepted, type OnboardingDocument, type OnboardingStep } from "@/lib/onboarding/documents";
import { changeOnboardingStep } from "@/lib/portal/onboarding-actions";
import { PortalTableRow } from "./portal-table-row";
import { toast } from "./toast";

export function OnboardingStepList({ documents, layout, readOnly }: { documents: OnboardingDocument[]; layout: OnboardingStep[]; readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const steps = layout.filter(step => !step.deleted);
  const change = (operation: Parameters<typeof changeOnboardingStep>[0], message: string) => startTransition(async () => {
    try {
      const result = await changeOnboardingStep(operation);
      toast(result.error ?? message, result.error ? "error" : "ok");
    } catch {
      toast("Couldn’t change the step. Try again.", "error");
    }
  });
  return <div className="portal-table-wrap">
    <table className="portal-table onboarding-docs">
      <thead><tr><th>Step</th><th>Document</th><th>Version</th><th>Last saved</th><th>Controls</th></tr></thead>
      <tbody>{steps.map((step, index) => {
        const document = documents.find(document => document.key === step.key);
        const locked = index < 2;
        const href = `/portal/legals/onboarding/${step.key}`;
        return <PortalTableRow key={step.key} href={href}>
          <td className="onboarding-figure">{index}</td>
          <td>{document ? <><Link className="portal-row-title" href={href}>{document.title}</Link><small className="portal-muted">{document.statement}</small></> : <Link className="portal-row-title" href={href}>Profile</Link>}
            {step.hidden && <small className="portal-muted">Hidden from Request access</small>}
          </td>
          <td className="onboarding-figure">{document?.version ?? "Alpha"}</td>
          <td>{document?.savedAt ? <>{formatAccepted(document.savedAt)}<small className="portal-muted">{document.savedBy}</small></> : <span className="portal-tag">Original draft</span>}</td>
          <td>{locked ? <span className="portal-muted onboarding-locked"><Lock size={14} aria-hidden="true" /> Locked</span> : readOnly ? <span className="portal-muted">{step.hidden ? "Hidden" : "Visible"}</span> : <div className="onboarding-step-controls">
            <button type="button" className="portal-icon-button" aria-label={`Move ${document?.title} up`} title="Move step up" disabled={pending || index === 2} onClick={() => change({ operation: "move", key: step.key, direction: -1 }, "Step moved up.")}><ArrowUp size={15} aria-hidden="true" /></button>
            <button type="button" className="portal-icon-button" aria-label={`Move ${document?.title} down`} title="Move step down" disabled={pending || index === steps.length - 1} onClick={() => change({ operation: "move", key: step.key, direction: 1 }, "Step moved down.")}><ArrowDown size={15} aria-hidden="true" /></button>
            <button type="button" className="portal-button is-ghost is-small" disabled={pending} onClick={() => change({ operation: "visibility", key: step.key, visible: step.hidden }, step.hidden ? "Step shown in Request access." : "Step hidden from Request access.")}>{step.hidden ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}{step.hidden ? "Unhide step" : "Hide step"}</button>
          </div>}</td>
        </PortalTableRow>;
      })}</tbody>
    </table>
  </div>;
}

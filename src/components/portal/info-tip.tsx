import { useId, type ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * An "i" icon that shows guide text on hover or keyboard focus. The portal keeps explanations in
 * these rather than as text under headings and fields, so pages stay uncluttered.
 */
export function InfoTip({ children, label = "More info" }: { children: ReactNode; label?: string }) {
  const id = useId();
  return (
    <span className="portal-info">
      <button type="button" className="portal-info-button" aria-label={label} aria-describedby={id}>
        <Info size={14} strokeWidth={2} aria-hidden="true" />
      </button>
      <span className="portal-info-tip" role="tooltip" id={id}>{children}</span>
    </span>
  );
}

/** A page or card heading with its guide text behind an "i" icon. */
export function TitleWithInfo({ as: Tag = "h1", className, id, info, children }: { as?: "h1" | "h2"; className?: string; id?: string; info: ReactNode; children: ReactNode }) {
  return (
    <div className="portal-title-row">
      <Tag className={className} id={id}>{children}</Tag>
      <InfoTip>{info}</InfoTip>
    </div>
  );
}

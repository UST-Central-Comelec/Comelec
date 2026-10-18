import type { DocumentProgress } from "@/lib/filing-portal/types";
import "../filing-review.css";

const share = (count: number, total: number) => `${(count / Math.max(total, 1)) * 100}%`;

/** An application's documents at a glance: approved, waiting for review, returned, out of all its requirements. */
export function DocumentBar({ progress, large = false }: { progress: DocumentProgress; large?: boolean }) {
  const { total, approved, waiting, changes } = progress;
  const parts = [approved && `${approved} approved`, waiting && `${waiting} to review`, changes && `${changes} returned`].filter(Boolean).join(", ");
  return (
    <span className={`fr-progress${large ? " is-large" : ""}`}>
      <span className="fr-progress-bar" role="img" aria-label={`${parts || "Nothing approved yet"}, of ${total} documents`}>
        {approved > 0 && <i className="is-ok" style={{ width: share(approved, total) }} />}
        {waiting > 0 && <i className="is-gold" style={{ width: share(waiting, total) }} />}
        {changes > 0 && <i className="is-warn" style={{ width: share(changes, total) }} />}
      </span>
      <span className="fr-progress-text" aria-hidden="true">
        <b>{approved}</b> of {total} approved{waiting > 0 && ` · ${waiting} to review`}{changes > 0 && ` · ${changes} returned`}
      </span>
    </span>
  );
}

import type { ReactNode } from "react";
import { Eye } from "lucide-react";

/**
 * For Advisers and Admins, who read the portal without changing it. A form put inside is shown as
 * it stands, with every field switched off and nothing to save with. The server refuses their
 * changes whatever the page shows (requireEditor in src/lib/auth/session.ts).
 */
export function ViewOnly({ when, children }: { when: boolean; children: ReactNode }) {
  if (!when) return <>{children}</>;
  return <fieldset className="portal-view-only" disabled>{children}</fieldset>;
}

/** Says why there's nothing to add or save, where a page would otherwise have its main button. */
export function ViewOnlyTag() {
  return <span className="portal-tag portal-view-only-tag"><Eye size={12} aria-hidden="true" /> View only</span>;
}

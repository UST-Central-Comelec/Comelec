import type { ReactNode } from "react";

// Deployment is applied by the database after its grace period, including with no browser open.
// Read current settings on each visit rather than serving a pre-application page from the route cache.
export const dynamic = "force-dynamic";

export default function EventsLayout({ children }: { children: ReactNode }) {
  return children;
}

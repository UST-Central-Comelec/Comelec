"use client";

import { ErrorScreen, type ErrorProps } from "@/components/fallback/error-screen";

// Shown under the view-mode strip when a previewed page fails to render.

export default function ViewModeError(props: ErrorProps) {
  return <ErrorScreen {...props} home={{ label: "Back to the portal", href: "/portal" }} />;
}

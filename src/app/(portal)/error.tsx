"use client";

import { ErrorScreen, type ErrorProps } from "@/components/fallback/error-screen";

// Shown full-screen when a portal page outside the dashboard fails (sign-in, requesting access), or
// when the dashboard's own shell does. Pages inside the shell have portal/(dashboard)/error.tsx.

export default function PortalError(props: ErrorProps) {
  return <ErrorScreen {...props} home={{ label: "Back to the portal", href: "/portal" }} />;
}

"use client";

import { ErrorScreen, type ErrorProps } from "@/components/fallback/error-screen";

// Shown between the site's header and footer when a page fails to render.

export default function SiteError(props: ErrorProps) {
  return <ErrorScreen {...props} belowHeader />;
}

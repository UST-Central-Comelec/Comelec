"use client";

import { useEffect } from "react";
import { FallbackScreen } from "./fallback-screen";

export type ErrorProps = { error: Error & { digest?: string }; retry: () => void };

/**
 * "Something went wrong", for the error boundaries (error.tsx and global-error.tsx). `home` is where
 * the second button leads: the site's home page, or the portal's.
 */
export function ErrorScreen({ error, retry, home = { label: "Back to home", href: "/" }, belowHeader }: ErrorProps & { home?: { label: string; href: string }; belowHeader?: boolean }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FallbackScreen
      code="500"
      eyebrow="Something went wrong"
      title={<>We’ve drifted <em>off course.</em></>}
      actions={[{ label: "Try again", primary: true, onClick: retry }, home]}
      reference={error.digest}
      belowHeader={belowHeader}
    >
      A problem on our end stopped this page from loading. It isn’t anything you did. Try again in a moment, and if it keeps happening, let us know at <a href="mailto:comelec@ust.edu.ph">comelec@ust.edu.ph</a>.
    </FallbackScreen>
  );
}

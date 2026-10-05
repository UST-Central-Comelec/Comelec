"use client";

import { Geist } from "next/font/google";
import { ErrorScreen, type ErrorProps } from "@/components/fallback/error-screen";
import { serif } from "./(site)/fonts";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// The last resort: shown when a root layout itself fails (the site's reads the application and
// filing periods, for one), so no header, footer or stylesheet of ours is there. It replaces the
// whole document.

export default function GlobalError({ error, retry }: ErrorProps) {
  return (
    <html lang="en" className={`${geist.variable} ${serif.variable}`}>
      <body className="fb-body">
        <title>Something went wrong | UST Central Comelec</title>
        <ErrorScreen error={error} retry={retry} />
      </body>
    </html>
  );
}

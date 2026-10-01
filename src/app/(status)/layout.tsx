import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { mono, serif } from "../(site)/fonts";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "UST Central Comelec", template: "%s | UST Central Comelec" },
  // A notice, not content: keep it out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: "/images/Logo-1.png" },
};

export const viewport: Viewport = { themeColor: "#030305", colorScheme: "dark" };

/**
 * Pages that stand in for the whole website (maintenance). No header, footer or data: nothing here
 * may depend on the database, since these are what's shown when it can't be reached.
 */
export default function StatusLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${mono.variable} ${serif.variable}`}>
      <body className="fb-body">{children}</body>
    </html>
  );
}

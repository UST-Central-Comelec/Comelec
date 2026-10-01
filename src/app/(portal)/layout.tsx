import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./portal.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
// Code, reference codes and pasted data only; labels and figures use the sans face.
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// The home page's gold italic, for accent words in headings.
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-serif" });

export const metadata: Metadata = {
  title: { default: "Commission Portal", template: "%s · Commission Portal" },
  // The portal is reached by URL only — keep it out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: "/images/Logo-1.png" },
};

// The browser's own bars and controls go dark with the portal (--p-bg in portal.css).
export const viewport: Viewport = { themeColor: "#030305", colorScheme: "dark" };

export default function PortalRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body className="portal">{children}</body>
    </html>
  );
}

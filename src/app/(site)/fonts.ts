import { Geist_Mono, Instrument_Serif } from "next/font/google";

// The site's type beside Geist, loaded once: labels, codes and figures in mono, as in the portal; the
// serif italic carries the accent words. The site layout puts both on <html> for the navbar, and the
// home page and newsroom use them throughout.
export const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
export const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-serif" });

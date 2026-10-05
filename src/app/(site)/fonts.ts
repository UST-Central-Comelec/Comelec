import { Instrument_Serif } from "next/font/google";

// The site's type beside Geist, loaded once: the serif italic that carries the accent words. Labels and
// figures are in Geist itself, as in the portal. The site layout puts it on <html> for the navbar, and
// the home page and newsroom use it throughout.
export const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", variable: "--font-serif" });

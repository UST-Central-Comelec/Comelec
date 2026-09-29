import type { Metadata } from "next";
import "../globals.css";
import { Geist } from "next/font/google";
import { ViewModeStrip } from "@/components/view-mode-strip";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "View mode", template: "%s | UST Central Comelec" },
  // Reached from the portal only.
  robots: { index: false, follow: false },
  icons: { icon: "/images/Logo-1.png" },
};

/** Site pages as commissioners preview them: no site header or footer, just a strip to leave view mode. */
export default function ViewModeLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="view-mode">
        <ViewModeStrip />
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SiteLoader } from "@/components/site-loader";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "UST Central Comelec",
    template: "%s | UST Central Comelec",
  },
  description:
    "The official election commission of the University of Santo Tomas.",
  icons: {
    icon: "/images/Logo-1.png",
    shortcut: "/images/Logo-1.png",
    apple: "/images/Logo-1.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <SiteLoader />
        <SmoothScroll>
          <SiteHeader />
          {children}
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  );
}

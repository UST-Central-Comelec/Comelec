import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./portal.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "Commission Portal", template: "%s · Commission Portal" },
  // The portal is reached by URL only — keep it out of search engines.
  robots: { index: false, follow: false },
  icons: { icon: "/images/Logo-1.png" },
};

export default function PortalRootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="portal">{children}</body>
    </html>
  );
}

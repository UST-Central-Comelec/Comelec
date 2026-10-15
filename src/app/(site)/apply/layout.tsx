import { ApplyBanner } from "@/components/apply-banner";

/** Shared by Become a Commissioner (/apply) and Track application (/apply/track). */
export default function ApplyLayout({ children }: LayoutProps<"/apply">) {
  return (
    <main className="apply-page">
      <ApplyBanner />
      {children}
    </main>
  );
}

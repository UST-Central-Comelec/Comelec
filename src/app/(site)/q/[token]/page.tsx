import Link from "next/link";
import { redirect } from "next/navigation";
import { findQrTarget } from "@/lib/events/qr-codes";
import "../../banner-page.css";

export const metadata = { title: "QR code", robots: { index: false, follow: false } };

/** A scanned event-form QR code: forwards to the form, or says the code has been replaced. */
export default async function QrPage({ params }: PageProps<"/q/[token]">) {
  const { token } = await params;
  const target = await findQrTarget(token);
  if (target) redirect(target);
  return (
    <main className="bp bp-qr-gone">
      <section className="bp-qr-card">
        <p className="bp-eyebrow">QR code</p>
        <h1>This QR code no longer works.</h1>
        <p>The organizers made a new code for this form. Ask them for the current one, or find the event on the Events page.</p>
        <Link className="bp-button is-primary is-small" href="/events">Browse events</Link>
      </section>
    </main>
  );
}

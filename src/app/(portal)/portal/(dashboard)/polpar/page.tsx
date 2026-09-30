import { redirect } from "next/navigation";

/** PolPaR opens on its Registrations tab. */
export default function PortalPolParPage() {
  redirect("/portal/polpar/registrations");
}

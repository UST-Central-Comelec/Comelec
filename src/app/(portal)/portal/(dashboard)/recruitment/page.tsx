import { redirect } from "next/navigation";

/** Recruitment opens on its Applications tab. */
export default function PortalRecruitmentPage() {
  redirect("/portal/recruitment/applications");
}

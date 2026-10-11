import { SlidingSubtabs } from "./sliding-subtabs";

export function ApplicantsTabs({ current }: { current: "applicants" | "onboarding" }) {
  return <SlidingSubtabs items={[
    { key: "applicants", label: "Applicants", href: "/portal/recruitment/applications" },
    { key: "onboarding", label: "Onboarding settings", href: "/portal/recruitment/applications/onboarding" },
  ]} active={current} label="Applicants tabs" scope="recruitment-applicants" />;
}

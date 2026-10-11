import { AccessControlLoader } from "@/components/portal/access-control-loader";

export default function AccessControlLoading() {
  return <main className="portal-access-workspace" aria-busy="true" aria-label="Loading Access Control"><AccessControlLoader /></main>;
}

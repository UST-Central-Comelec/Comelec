export function AccountKindLabel({ kind }: { kind: "official" | "personal" }) {
  return <span className={`portal-account-kind is-${kind}`}>
    {kind === "official" ? "Official account" : "Commissioner"}
  </span>;
}

export function AccountStatusLabel({ status, title }: { status: "active" | "pending" | "revoked"; title?: string }) {
  return <span className={`portal-account-status is-${status}`} title={title}>
    <span className="portal-account-status-mark" aria-hidden="true" />
    {status === "active" ? "Active" : status === "pending" ? "Pending" : "Revoked"}
  </span>;
}

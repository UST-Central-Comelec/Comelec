const messages: Record<string, string> = {
  created: "Saved. It’s now live on the website.",
  updated: "Changes saved and published.",
  deleted: "Deleted. It’s been removed from the website.",
  "account-updated": "Account details saved.",
  "account-created": "Account added. They can now sign in with Google using that UST email.",
  revoked: "Access revoked. They’re blocked from the portal, including any open session.",
  restored: "Access restored. They can sign in again.",
  "slots-saved": "Slots saved. The Apply page now shows the new counts.",
};

export function Notice({ notice }: { notice?: string | string[] }) {
  const message = typeof notice === "string" ? messages[notice] : undefined;
  return message ? <p className="portal-notice" role="status">{message}</p> : null;
}

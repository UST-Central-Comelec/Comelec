const messages: Record<string, string> = {
  created: "Saved. It’s now live on the website.",
  updated: "Changes saved and published.",
  deleted: "Deleted. It’s been removed from the website.",
  "account-updated": "Account details saved.",
  "account-created": "Account added. They can now sign in with Google using that UST email.",
  revoked: "Access revoked. They’re blocked from the portal, including any open session.",
  restored: "Access restored. They can sign in again.",
  "access-approved": "Request approved. Their account is added, and they’ve been emailed that they can sign in.",
  "access-declined": "Request declined, and they’ve been emailed. They see the decision when they track their request.",
  "slots-saved": "Slots saved. The Apply page now shows the new counts.",
  "slots-unchanged": "Nothing to save: no counts were changed.",
  "application-accepted": "Marked as accepted, and one slot for this position is now taken. The applicant sees this when they track their application.",
  "application-declined": "Marked as rejected. The applicant sees this when they track their application.",
  "application-accepted-emailed": "Marked as accepted, and the applicant has been emailed. One slot for this position is now taken.",
  "application-declined-emailed": "Marked as rejected, and the applicant has been emailed.",
  "application-pending": "Moved back to pending review.",
  "application-deleted": "Application deleted. The applicant can no longer track it.",
  "slot-added": "Interview slot added. Applicants can pick it on the Apply page.",
  "slots-added": "Interview slots added. Applicants can pick them on the Apply page.",
  "slot-deleted": "Interview slot deleted.",
  "period-scheduled": "Application period saved. Applications close automatically at the time you set, and the Apply page counts down to it.",
  "period-open": "Applications are open, with no closing date.",
  "period-closed": "Applications close in 5 minutes, so anyone already filling in the form can still submit. You can cancel until then.",
  "period-close-cancelled": "Closing cancelled. Applications stay open.",
  "filing-scheduled": "Saved. It’s open now and closes automatically at the time you set; the public page counts down to it.",
  "filing-open": "Saved. It’s open now, with no closing date.",
  "filing-closed": "Saved. It closes in 5 minutes, so anyone partway through can still submit. You can cancel until then.",
  "filing-close-cancelled": "Closing cancelled. It stays open.",
};

/** Notices for something that half-worked: shown as a warning. */
const warnings: Record<string, string> = {
  "slot-booked": "That slot wasn’t deleted: an applicant booked it just now.",
  "access-needs-migration": "Not approved yet: the database needs an update first. Run supabase/migrations/0017_account_affiliation.sql in the Supabase SQL Editor, then approve again.",
  "access-request-gone": "That request was already decided by another executive, or it no longer exists.",
  "filing-cancel-too-late": "Too late to cancel: the grace period had already ended, so it’s closed. Choose Scheduled or Always open to reopen it.",
  "period-cancel-too-late": "Too late to cancel: the grace period had already ended, so applications are closed. Choose Scheduled or Always open to reopen them.",
  "application-no-slots": "Not accepted: this position has no slots left. Add a slot under Recruitment → Slots first, then accept again.",
  "application-accepted-email-failed": "Marked as accepted, but the email didn’t send. Check SMTP_USER and SMTP_PASSWORD in .env.local, or use Send email.",
  "application-declined-email-failed": "Marked as rejected, but the email didn’t send. Check SMTP_USER and SMTP_PASSWORD in .env.local, or use Send email.",
};

export function Notice({ notice }: { notice?: string | string[] }) {
  if (typeof notice !== "string") return null;
  if (warnings[notice]) return <p className="portal-form-error" role="alert">{warnings[notice]}</p>;
  return messages[notice] ? <p className="portal-notice" role="status">{messages[notice]}</p> : null;
}

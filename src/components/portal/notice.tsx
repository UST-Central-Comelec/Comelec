const messages: Record<string, string> = {
  created: "Saved. It’s now live on the website.",
  updated: "Changes saved and published.",
  deleted: "Deleted. It’s been removed from the website.",
  "account-updated": "Account details saved. The Directory shows them now, and the account’s owner is emailed what changed.",
  "account-created": "Account added, and they’ve been emailed. They can now sign in with Google using that UST email, which is marked verified the first time they do.",
  "account-deleted": "Account deleted, and they’ve been emailed. They can no longer sign in, and they’re out of the Directory.",
  revoked: "Access revoked, and they’ve been emailed. They’re blocked from the portal, including any open session, and they’re out of the Directory.",
  restored: "Access restored, and they’ve been emailed. They can sign in again, and they’re back in the Directory.",
  "expiry-saved": "Expiry date saved. Commissioners’ access ends at the end of that day.",
  "access-saved": "Access saved. It applies from their next click.",
  "access-approved": "Request approved. Their account is added, with their email already verified, and they’ve been emailed its details and that they can sign in.",
  "access-declined": "Request declined, and they’ve been emailed. They see the decision when they track their request.",
  "slots-saved": "Slots saved. The Apply page now shows the new counts.",
  "slots-unchanged": "Nothing to save: no counts were changed.",
  "application-accepted": "Marked as accepted, and one slot for this position is now taken. The applicant sees this when they track their application.",
  "application-declined": "Marked as rejected. The applicant sees this when they track their application.",
  "application-onboarded": "Applicant onboarded. They’re now listed in the members directory with their accepted position.",
  "application-accepted-emailed": "Marked as accepted, and the applicant has been emailed. One slot for this position is now taken.",
  "application-declined-emailed": "Marked as rejected, and the applicant has been emailed.",
  "application-accepted-email-off": "Marked as accepted, and one slot for this position is now taken. The applicant wasn’t emailed: that email is switched off under Apps → Email Sender → Automatic. They see this when they track their application.",
  "application-declined-email-off": "Marked as rejected. The applicant wasn’t emailed: that email is switched off under Apps → Email Sender → Automatic. They see this when they track their application.",
  "application-pending": "Moved back to pending review.",
  "email-switches-saved": "Saved. It applies from the next email the site would send.",
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
  "maintenance-on": "The website is now under maintenance. Visitors see the maintenance page within about 10 seconds, until you switch it back to Live here.",
  "maintenance-off": "The website is live again. Visitors see it within about 10 seconds.",
  "maintenance-saved": "Maintenance settings saved.",
  "cookie-notice-shown": "Saved. The website shows the cookie notice to visitors who haven’t dismissed it.",
  "cookie-notice-hidden": "Saved. The website no longer shows the cookie notice.",
  "cookie-notice-reset": "Done. Everyone sees the cookie notice once more, including visitors who had dismissed it.",
  "period-dates": "Saved.",
  "filing-dates": "Saved.",
  "period-closed-now": "Applications are closed. They hadn’t opened yet, so nobody was partway through.",
  "filing-closed-now": "Closed. It hadn’t opened yet, so nobody was partway through.",
  "details-saved": "Saved. It stays closed: choose Scheduled to open it on its dates.",
  "event-created": "Event added. It’s now on the website’s Events page.",
  "event-updated": "Changes saved. The website shows them now.",
  "event-updated-addressed": "Changes saved, and the Central Comelec’s request is marked as addressed.",
  "event-deleted": "Event deleted. It’s off the website, and its registrations were deleted with it.",
  "event-changes-requested": "Request sent. The unit sees it on this event, and its commissioners have been emailed.",
  "event-changes-withdrawn": "Request withdrawn. The unit no longer sees it.",
  "event-changes-addressed": "Marked as addressed. The Central Comelec no longer sees the request as waiting.",
  "registration-removed": "Registration removed.",
  "statistic-created": "Table added. It’s now on the website’s Statistics page.",
  "statistic-updated": "Changes saved. The Statistics page shows them now.",
  "statistic-deleted": "Table deleted. It’s off the Statistics page.",
  "email-sending": "On its way. Each recipient gets their own copy; this page shows how far it’s got.",
  "email-scheduled": "Scheduled. It goes out at the time you set, to whoever matches the recipients then. You can cancel it until it starts sending.",
  "email-cancelled": "Cancelled. It won’t be sent.",
  "code-submitted": "Sent for approval. The Chairperson, the Vice Chairperson and the Secretary to the Executive have been emailed, and it’s waiting for them under Apps → Approvals; the rest of the Central Comelec’s Executive Board is told too. Its text is locked until they decide.",
  "code-withdrawn": "Withdrawn from approval. It’s a draft again, any approvals it had are cleared, and the Central Comelec’s Executive Board is told.",
  "code-discarded": "Draft discarded. The published text is as it was, and a new revision can be started.",
  "code-approved": "Approved, and the Central Comelec’s Executive Board and its editors are emailed that you did. It’s published once the other approvals are in.",
  "code-published": "Approved by all three, and published. The website shows the new text now, and the Central Comelec’s Executive Board and its editors have been emailed.",
  "code-returned": "Sent back for changes. It’s a draft again, and its editors and the Central Comelec’s Executive Board have been emailed what you wrote.",
};

/** Notices for something that half-worked: shown as a warning. */
const warnings: Record<string, string> = {
  "slot-booked": "That slot wasn’t deleted: an applicant booked it just now.",
  "access-needs-migration": "Not approved yet: the database needs an update first. Run supabase/migrations/0021_account_profiles_and_access.sql and 0022_official_accounts_and_viewers.sql in the Supabase SQL Editor, then approve again.",
  "access-request-gone": "That request was already decided by someone else, or it no longer exists.",
  "access-needs-role": "Not approved yet: pick their position and role on the request first, then approve again.",
  "access-out-of-reach": "Not approved: that position or unit isn’t yours to give. Pick one within your reach, or leave the request to the Central Executive Board.",
  "access-role-taken": "Not approved yet: that college already has a Central Representative. Change or revoke that account first, or pick another role.",
  "filing-cancel-too-late": "Too late to cancel: the grace period had already ended, so it’s closed. Choose Scheduled or Always open to reopen it.",
  "period-cancel-too-late": "Too late to cancel: the grace period had already ended, so applications are closed. Choose Scheduled or Always open to reopen them.",
  "application-no-slots": "Not accepted: this position has no slots left. Add a slot under Recruitment → Slots first, then accept again.",
  "application-accepted-email-failed": "Marked as accepted, but the email didn’t send. Check SMTP_USER and SMTP_PASSWORD in .env.local, or use Send email.",
  "application-declined-email-failed": "Marked as rejected, but the email didn’t send. Check SMTP_USER and SMTP_PASSWORD in .env.local, or use Send email.",
  "email-too-late": "Too late: that email had already started sending, or was already cancelled.",
  "code-submitted-no-email": "Sent for approval, and it’s waiting under Apps → Approvals, but those who sign weren’t emailed: the email didn’t send, or it’s switched off under Email Sender → Automatic. Let them know yourself.",
  "code-published-no-email": "Approved by all three, and published: the website shows the new text now. The Central Comelec and its editors weren’t emailed: the email didn’t send, or it’s switched off under Email Sender → Automatic.",
  "code-returned-no-email": "Sent back for changes, and it’s a draft again, but its editors and the Central Comelec weren’t emailed: the email didn’t send, or it’s switched off under Email Sender → Automatic. Let them know yourself.",
  "code-moved-on": "Nothing was changed: this revision had already moved on. This is where it stands now.",
  "code-already-signed": "Nothing was changed: your office had already approved this revision.",
  "code-busy": "That didn’t go through: others were deciding on it at the same moment. Open it again to see where it stands.",
  "email-not-configured": "Not sent: email isn’t set up on the server. Set SMTP_USER and SMTP_PASSWORD in .env.local, then send again.",
  "event-changes-requested-no-email": "Request saved, and the unit sees it on this event, but its commissioners weren’t emailed: the email didn’t send, or it’s switched off under Email Sender → Automatic. Let them know yourself.",
};

/**
 * Notices for a change to the commission's settings. What changed is emailed to the Central
 * Comelec (src/lib/notifications/settings-emails.ts) unless that's switched off under Email Sender
 * → Automatic, and the notice says so. Opening or closing a unit's own Recruitment, Political Party
 * Registration or Filing of Candidacy is emailed to that unit instead.
 */
const announced = /^(maintenance|cookie-notice)-|^(slots-saved|access-saved|expiry-saved|email-switches-saved)$/;
const announcedToUnit = /^(period|filing)-(?!.*too-late|dates$)/;

export function Notice({ notice }: { notice?: string | string[] }) {
  if (typeof notice !== "string") return null;
  if (warnings[notice]) return <p className="portal-form-error" role="alert">{warnings[notice]}</p>;
  if (!messages[notice]) return null;
  const told = announcedToUnit.test(notice) ? "the unit’s" : announced.test(notice) ? "the Central Comelec’s" : null;
  return <p className="portal-notice" role="status">{messages[notice]}{told && ` A change here is emailed to ${told} official account and Executive Board, unless that’s switched off under Apps → Email Sender → Automatic.`}</p>;
}

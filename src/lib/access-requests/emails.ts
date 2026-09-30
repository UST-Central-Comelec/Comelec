import "server-only";

import { escape, greetingName, layout, siteUrl } from "@/lib/applications/emails";
import type { Email } from "@/lib/email/send";

// The emails someone requesting portal access gets: a confirmation when they send the request,
// and the decision when an executive approves or declines it under Accounts.

type Requester = { email: string; firstName: string; referenceCode: string };

export function accessReceivedEmail(requester: Requester): Email {
  const trackUrl = `${siteUrl()}/apply/track?ref=${requester.referenceCode}`;
  const lines = [
    `Hi ${greetingName(requester.firstName)},`,
    `We’ve received your request for access to the Commission Portal. A Central Comelec executive will review it.`,
    `To check on it, go to Track application and enter your reference code with your student number: ${trackUrl}`,
  ];
  return {
    to: requester.email,
    subject: `Portal access request received (${requester.referenceCode})`,
    text: `${lines.join("\n\n")}\n\nReference code: ${requester.referenceCode}\n\nUST Central Commission on Elections`,
    html: layout([
      escape(lines[0]),
      escape(lines[1]),
      `To check on it, go to <a href="${escape(trackUrl)}" style="color:#1d1c1b">Track application</a> and enter your reference code with your student number.`,
    ], requester.referenceCode),
  };
}

export function accessDecisionEmail(requester: Requester, approved: boolean): Email {
  const loginUrl = `${siteUrl()}/portal/login`;
  const lines = approved
    ? [`Hi ${greetingName(requester.firstName)},`, `Your request for Commission Portal access was approved. Sign in with Google using this UST account: ${loginUrl}`]
    : [`Hi ${greetingName(requester.firstName)},`, `Your request for Commission Portal access wasn’t approved. If you think this is a mistake, reply to this email or contact a Central Comelec executive.`];
  return {
    to: requester.email,
    subject: approved ? `Portal access approved (${requester.referenceCode})` : `Your portal access request (${requester.referenceCode})`,
    text: `${lines.join("\n\n")}\n\nReference code: ${requester.referenceCode}\n\nUST Central Commission on Elections`,
    html: layout(
      approved
        ? [escape(lines[0]), `Your request for Commission Portal access was approved. <a href="${escape(loginUrl)}" style="color:#1d1c1b">Sign in with Google</a> using this UST account.`]
        : lines.map(escape),
      requester.referenceCode,
    ),
  };
}

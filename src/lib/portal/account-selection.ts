/** The chosen membership is a preference; the server checks its ownership and access on every request. */
export const ACCOUNT_COOKIE = "portal_account";
export const accountCookieOptions = {
  path: "/portal",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30,
};

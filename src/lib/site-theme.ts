// Shared by the navbar's switch (src/components/site-theme.tsx)
// and the cookie policy (src/app/(site)/cookies/page.tsx).

/** Where the browser remembers the site's theme. Local storage, not a cookie: it never leaves the device. Listed in the policy. */
export const SITE_THEME_KEY = "comelec:theme";

export type SiteTheme = "dark" | "light";

/** The site is dark unless the visitor chose otherwise. */
export const readSiteTheme = (value: string | null | undefined): SiteTheme => (value === "light" ? "light" : "dark");


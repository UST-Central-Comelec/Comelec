/** Remembers the portal's theme ("light" or "dark"), so the server renders the right one on the next visit. */
export const THEME_COOKIE = "portal_theme";

export type PortalTheme = "dark" | "light";

/** The portal is dark unless the cookie says otherwise. */
export const readTheme = (value: string | undefined): PortalTheme => (value === "light" ? "light" : "dark");

/** Each theme's page colour (--p-bg in portal.css), for the browser's own bars. */
export const THEME_COLOR: Record<PortalTheme, string> = { dark: "#030305", light: "#f5f5f7" };

/** Up to this width the sidebar is the header across the top, and it's dark in both themes (portal.css). */
export const PHONE_QUERY = "(max-width: 860px)";

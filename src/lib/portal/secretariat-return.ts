// Database opened from Secretariat → Settings carries ?from=secretariat-settings, so the sidebar's back
// link returns to Settings' Destination Offices. Only this fixed value is read: never a URL.
export const SECRETARIAT_OFFICES_HREF = "/portal/secretariat/settings?tab=offices";
export const SECRETARIAT_RETURN = "secretariat-settings";

export const fromSecretariatSettings = (value: string | null | undefined) => value === SECRETARIAT_RETURN;

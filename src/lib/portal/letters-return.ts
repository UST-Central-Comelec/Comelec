// An event opened from the Letters Tracker carries ?from=letters-tracker, so its back links (the
// sidebar's and the page's) return to the tracker. Only this fixed value is read: never a URL.
export const LETTERS_TRACKER_HREF = "/portal/secretariat/letters-tracker";
export const LETTERS_RETURN = "letters-tracker";

export const fromLettersTracker = (value: string | null | undefined) => value === LETTERS_RETURN;

/** The same address, marked as opened from the Letters Tracker. */
export const withLettersReturn = (href: string) => `${href}${href.includes("?") ? "&" : "?"}from=${LETTERS_RETURN}`;

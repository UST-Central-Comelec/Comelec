import { withoutEmoji } from "./input";

const profilePrefix = "https://facebook.com/";
export const facebookUsernameMaxLength = 300 - profilePrefix.length;

export function facebookUsername(value: string) {
  return withoutEmoji(value).trim()
    .replace(/^(?:https?:\/\/)?(?:(?:www|web|m)\.)?(?:facebook|fb)\.com(?:\/|$)/i, "")
    .replace(/^\/+|\/+$/g, "");
}

export function facebookProfileUrl(value: string) {
  const username = facebookUsername(value);
  return username ? `${profilePrefix}${username}` : "";
}

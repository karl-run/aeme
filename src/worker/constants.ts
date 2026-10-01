export const BASE_URL = "https://æme.karl.run";
export const LOGIN_URL = `${BASE_URL}/login`;

/** Workers run in UTC, so anything rendered server-side for humans needs an
 * explicit zone or it comes out hours off. Single-workspace assumption — if
 * æme ever serves more than one, this belongs on `channels`. */
export const DISPLAY_TIME_ZONE = "Europe/Oslo";

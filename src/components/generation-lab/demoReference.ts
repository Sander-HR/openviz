/**
 * Default reference image for the generation lab demo nodes.
 *
 * Served from `public/images/` so it is a normal static URL rather than an
 * inline base64 data URL. Previously this was a multi-KB base64 literal, which
 * bloated the dev HMR websocket (the whole string was hot-reloaded as module
 * source) and any bundle that imported it.
 */
export const DEMO_REFERENCE_DATA_URL = "/images/demo-reference.png";

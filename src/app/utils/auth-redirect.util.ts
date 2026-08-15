/**
 * Public origin of the deployed web app. Native auth callbacks are sent here as
 * verified Android App Links rather than to a `voxfit://` custom scheme.
 *
 * Custom schemes are first-come-claimed on Android — any installed app could
 * register `voxfit://`, receive the password-recovery intent and read the
 * access_token/refresh_token straight out of it, which is full account takeover.
 * An https App Link is bound to this domain by
 * `/.well-known/assetlinks.json`, so only an app signed with a listed
 * certificate can intercept it.
 *
 * Must stay in sync with the `android:host` in AndroidManifest.xml and with the
 * domain serving assetlinks.json.
 */
const NATIVE_AUTH_ORIGIN = 'https://voxfit.amitpile.com';

/**
 * Without an explicit redirect, GoTrue falls back to the project's static Site URL dashboard
 * setting for every auth email regardless of platform. Native builds point at the App Link
 * origin above (there's no HTTP origin of their own to return to); web keeps using the calling
 * origin so dev and prod each land back on themselves.
 *
 * If App Link verification fails on a device, the native URL simply opens in the browser and
 * the user completes the flow in the web app — degraded, but never insecure.
 */
export function buildAuthRedirectUrl(path: 'confirmed' | 'reset-password', isNative: boolean, origin: string): string {
  return isNative ? `${NATIVE_AUTH_ORIGIN}/auth/${path}` : `${origin}/auth/${path}`;
}

export interface ParsedAuthCallback {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly type: string;
}

/**
 * Android hands a full deep-link URL to `appUrlOpen` (e.g. `voxfit://auth/confirmed#access_token=
 * ...&refresh_token=...&type=signup`) — `detectSessionInUrl` doesn't run for native deep links,
 * so this app has to parse the hash fragment itself. An expired/already-used link comes back as
 * `#error=...` with no tokens, which this treats the same as any other malformed callback: null.
 */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback | null {
  let hash: string;
  try {
    hash = new URL(url).hash;
  } catch {
    return null;
  }
  if (!hash) {
    return null;
  }
  const params = new URLSearchParams(hash.slice(1));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');
  if (!accessToken || !refreshToken || !type) {
    return null;
  }
  return { accessToken, refreshToken, type };
}

export function resolvePostAuthRoute(type: string): string {
  return type === 'recovery' ? '/auth/reset-password' : '/auth/confirmed';
}

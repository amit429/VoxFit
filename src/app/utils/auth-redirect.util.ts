/**
 * Without an explicit redirect, GoTrue falls back to the project's static Site URL dashboard
 * setting for every auth email regardless of platform. Native builds need the app's own
 * custom scheme (there's no HTTP origin to return to); web keeps using the calling origin so
 * dev and prod each land back on themselves.
 */
export function buildAuthRedirectUrl(path: 'confirmed' | 'reset-password', isNative: boolean, origin: string): string {
  return isNative ? `voxfit://auth/${path}` : `${origin}/auth/${path}`;
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

import { buildAuthRedirectUrl, parseAuthCallbackUrl, resolvePostAuthRoute } from './auth-redirect.util';

describe('buildAuthRedirectUrl', () => {
  it('builds an App Link URL for the confirm-signup path on native', () => {
    expect(buildAuthRedirectUrl('confirmed', true, 'http://localhost:4200')).toBe(
      'https://voxfit.amitpile.com/auth/confirmed',
    );
  });

  it('builds an origin-relative URL for the confirm-signup path on web', () => {
    expect(buildAuthRedirectUrl('confirmed', false, 'http://localhost:4200')).toBe(
      'http://localhost:4200/auth/confirmed',
    );
  });

  it('builds an App Link URL for the reset-password path on native', () => {
    expect(buildAuthRedirectUrl('reset-password', true, 'http://localhost:4200')).toBe(
      'https://voxfit.amitpile.com/auth/reset-password',
    );
  });

  it('builds an origin-relative URL for the reset-password path on web, using the given origin', () => {
    expect(buildAuthRedirectUrl('reset-password', false, 'https://voxfit.amitpile.com')).toBe(
      'https://voxfit.amitpile.com/auth/reset-password',
    );
  });

  /*
   * Regression guard for SEC-11. A native redirect must never go back to a custom
   * scheme: `voxfit://` is claimable by any installed app, and these URLs carry
   * password-recovery tokens. If someone reintroduces it, this fails loudly.
   */
  it('never emits a custom-scheme URL for native', () => {
    for (const path of ['confirmed', 'reset-password'] as const) {
      const url = buildAuthRedirectUrl(path, true, 'http://localhost:4200');
      expect(url.startsWith('https://')).toBe(true);
      expect(url).not.toContain('voxfit://');
    }
  });
});

describe('parseAuthCallbackUrl', () => {
  it('parses a valid signup confirmation callback', () => {
    const url = 'https://voxfit.amitpile.com/auth/confirmed#access_token=abc&refresh_token=def&type=signup&expires_in=3600';
    expect(parseAuthCallbackUrl(url)).toEqual({ accessToken: 'abc', refreshToken: 'def', type: 'signup' });
  });

  it('parses a valid password-recovery callback', () => {
    const url = 'https://voxfit.amitpile.com/auth/reset-password#access_token=abc&refresh_token=def&type=recovery';
    expect(parseAuthCallbackUrl(url)).toEqual({ accessToken: 'abc', refreshToken: 'def', type: 'recovery' });
  });

  it('returns null for an expired/rejected link (error hash, no tokens)', () => {
    const url = 'https://voxfit.amitpile.com/auth/confirmed#error=access_denied&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallbackUrl(url)).toBeNull();
  });

  it('returns null when there is no hash fragment at all', () => {
    expect(parseAuthCallbackUrl('https://voxfit.amitpile.com/auth/confirmed')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(parseAuthCallbackUrl('not a url')).toBeNull();
  });
});

describe('resolvePostAuthRoute', () => {
  it('routes recovery callbacks to reset-password', () => {
    expect(resolvePostAuthRoute('recovery')).toBe('/auth/reset-password');
  });

  it('routes signup callbacks to confirmed', () => {
    expect(resolvePostAuthRoute('signup')).toBe('/auth/confirmed');
  });

  it('defaults unknown callback types to confirmed', () => {
    expect(resolvePostAuthRoute('email_change')).toBe('/auth/confirmed');
  });
});

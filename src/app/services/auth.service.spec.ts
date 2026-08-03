import { isAlreadyRegisteredSignUpResponse } from './auth.service';
import type { Session, User } from '@supabase/supabase-js';

function fakeUser(identities?: unknown[]): User {
  return { id: 'u1', identities } as unknown as User;
}

function fakeSession(): Session {
  return {} as Session;
}

describe('isAlreadyRegisteredSignUpResponse', () => {
  it('is true when signUp returns no session and an empty identities array (existing confirmed email)', () => {
    expect(isAlreadyRegisteredSignUpResponse({ session: null, user: fakeUser([]) })).toBe(true);
  });

  it('is false for a genuine new signup (no session, one identity)', () => {
    expect(isAlreadyRegisteredSignUpResponse({ session: null, user: fakeUser([{ id: 'x' }]) })).toBe(false);
  });

  it('is false when a session is returned (email confirmation disabled / immediate sign-in)', () => {
    expect(isAlreadyRegisteredSignUpResponse({ session: fakeSession(), user: fakeUser([]) })).toBe(false);
  });

  it('is false when there is no user at all', () => {
    expect(isAlreadyRegisteredSignUpResponse({ session: null, user: null })).toBe(false);
  });

  it('is false when identities is undefined (defensive default)', () => {
    expect(isAlreadyRegisteredSignUpResponse({ session: null, user: fakeUser(undefined) })).toBe(false);
  });
});

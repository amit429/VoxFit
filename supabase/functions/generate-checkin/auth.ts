// generate-checkin/auth.ts — pure invocation classification (unit-tested; no I/O).
//
// generate-checkin is reached two ways:
//   1. Client ("Check my progress"): the signed-in user's JWT is the bearer → derive
//      the user from the token (auth.getUser in index.ts).
//   2. Weekly cron (pg_net dispatcher): the project service-role key is the bearer and
//      the target user is in the body → act for that user with a service-role client.
//
// The service-role key is auto-injected into the edge runtime and never reaches a client,
// so a bearer equal to it can only have come from our own server-side pg_net call. That
// equality is the whole discriminator — a regular user cannot forge it to target someone else.

export type Invocation =
  | { kind: 'cron'; userId: string }
  | { kind: 'cron_missing_user' }
  | { kind: 'jwt' };

/** Constant-time compare so a near-miss bearer can't be brute-forced via timing. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function classifyInvocation(
  authHeader: string,
  serviceRoleKey: string | undefined,
  body: unknown,
): Invocation {
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (serviceRoleKey && bearer && safeEqual(bearer, serviceRoleKey)) {
    const raw = body && typeof body === 'object'
      ? (body as Record<string, unknown>)['user_id']
      : undefined;
    const userId = typeof raw === 'string' ? raw.trim() : '';
    return userId ? { kind: 'cron', userId } : { kind: 'cron_missing_user' };
  }
  return { kind: 'jwt' };
}

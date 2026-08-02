import { assertEquals } from 'jsr:@std/assert';
import { classifyInvocation, safeEqual } from './auth.ts';

const KEY = 'service-role-key-abc123';

Deno.test('safeEqual: equal strings match, unequal and different-length do not', () => {
  assertEquals(safeEqual('abc', 'abc'), true);
  assertEquals(safeEqual('abc', 'abd'), false);
  assertEquals(safeEqual('abc', 'abcd'), false);
  assertEquals(safeEqual('', ''), true);
});

Deno.test('classifyInvocation: service-role bearer + user_id -> cron', () => {
  const inv = classifyInvocation(`Bearer ${KEY}`, KEY, { user_id: 'user-1' });
  assertEquals(inv, { kind: 'cron', userId: 'user-1' });
});

Deno.test('classifyInvocation: service-role bearer, missing user_id -> cron_missing_user', () => {
  assertEquals(classifyInvocation(`Bearer ${KEY}`, KEY, {}).kind, 'cron_missing_user');
});

Deno.test('classifyInvocation: service-role bearer, non-string user_id -> cron_missing_user', () => {
  assertEquals(classifyInvocation(`Bearer ${KEY}`, KEY, { user_id: 42 }).kind, 'cron_missing_user');
});

Deno.test('classifyInvocation: service-role bearer, blank user_id -> cron_missing_user', () => {
  assertEquals(classifyInvocation(`Bearer ${KEY}`, KEY, { user_id: '   ' }).kind, 'cron_missing_user');
});

Deno.test('classifyInvocation: user JWT bearer (not the key) -> jwt', () => {
  assertEquals(classifyInvocation('Bearer some.user.jwt', KEY, { user_id: 'user-1' }).kind, 'jwt');
});

Deno.test('classifyInvocation: no auth header -> jwt', () => {
  assertEquals(classifyInvocation('', KEY, {}).kind, 'jwt');
});

Deno.test('classifyInvocation: service key unset in env -> jwt (never trust a body user_id)', () => {
  assertEquals(classifyInvocation(`Bearer ${KEY}`, undefined, { user_id: 'user-1' }).kind, 'jwt');
});

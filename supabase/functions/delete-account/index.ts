/// <reference path="../deno-global.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server not configured' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await callerClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401);
  const userId = userData.user.id;

  // Every table this account owns FKs to user_profiles (or, for exercises_logged, to
  // workout_sessions) with ON DELETE CASCADE, and user_profiles.id FKs to auth.users.id with
  // ON DELETE CASCADE too — confirmed live via pg_constraint. A single deleteUser call is
  // therefore enough; Postgres cascades the rest atomically in one transaction, so there's no
  // window where the account is left half-deleted by a failure partway through a manual chain.
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserErr) {
    console.error('[delete-account] deleteUser failed', deleteUserErr);
    return json({ error: `Failed to delete account: ${deleteUserErr.message}` }, 500);
  }

  return json({ success: true });
});

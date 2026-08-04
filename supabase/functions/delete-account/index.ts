/// <reference path="../deno-global.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { USER_SCOPED_TABLES } from './tables.ts';

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

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: sessions, error: sessionsErr } = await admin
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId);
  if (sessionsErr) return json({ error: `Failed to look up workout sessions: ${sessionsErr.message}` }, 500);

  const sessionIds = (sessions ?? []).map((s: { id: string }) => s.id);
  if (sessionIds.length > 0) {
    const { error } = await admin.from('exercises_logged').delete().in('session_id', sessionIds);
    if (error) return json({ error: `Failed to delete exercises_logged: ${error.message}` }, 500);
  }

  for (const step of USER_SCOPED_TABLES) {
    const { error } = await admin.from(step.table).delete().eq(step.column, userId);
    if (error) return json({ error: `Failed to delete ${step.table}: ${error.message}` }, 500);
  }

  const { error: deleteUserErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteUserErr) return json({ error: `Failed to delete auth user: ${deleteUserErr.message}` }, 500);

  return json({ success: true });
});

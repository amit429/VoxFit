export const environment = {
  production: false,
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  /**
   * LOCAL DEV ONLY, and only when `useGeminiEdgeFunction` is false.
   *
   * Everything in this object is compiled into the JavaScript bundle. `supabaseAnonKey`
   * is designed for that — it's useless without an RLS-passing session. A Gemini key is
   * not: it's a bearer credential billed to us, so anyone reading view-source could spend
   * it. Setting `useGeminiEdgeFunction: true` does NOT protect a key left here — that flag
   * only changes where calls are *routed* at runtime; the string is still in the bundle.
   *
   * Never copy a key into environment.prod.ts or a `geminiApiKey` build variable —
   * `scripts/generate-prod-env.js` fails the build if it finds one. Production keeps the
   * key server-side:  supabase secrets set GEMINI_API_KEY=...
   */
  geminiApiKey: '',
  /** When true, Gemini calls go through Supabase Edge Function (recommended for prod). */
  useGeminiEdgeFunction: false,
};

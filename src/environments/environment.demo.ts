export const environment = {
  production: false,
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
  /** Dev only: Gemini client-side key. Prefer Edge Function + secret for production. */
  geminiApiKey: '',
  /** When true, Gemini calls go through Supabase Edge Function (recommended for prod). */
  useGeminiEdgeFunction: false,
};

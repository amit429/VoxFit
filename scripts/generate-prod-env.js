// Generates the git-ignored src/environments/environment.prod.ts from environment
// variables. Runs automatically before `npm run build:prod` (see package.json's
// `prebuild:prod`). On a host like Cloudflare Pages that clones a fresh checkout,
// environment.prod.ts doesn't exist yet, so this creates it from the project's
// dashboard-configured env vars. Locally, if you already have your own
// environment.prod.ts, it's validated rather than overwritten.
//
// SECURITY: everything this file writes ends up in a public JavaScript bundle.
// `supabaseAnonKey` belongs there — it is designed to be public and is useless
// without RLS-passing auth. A Gemini key does NOT: it is a bearer credential
// billed to us, so it is refused outright below rather than merely defaulted to
// empty. Production reaches Gemini through Edge Functions, which hold the key
// server-side as a Supabase secret.
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const required = ['supabaseUrl', 'supabaseAnonKey'];
const hasAllEnvVars = required.every((key) => process.env[key]);

/**
 * Refuse to bundle a Gemini key into client-side code, wherever it came from.
 *
 * Any non-empty value is rejected, including placeholders like "no-value". That
 * is deliberate rather than a heuristic on key shape: "does this look like a real
 * key" is exactly the kind of guess that eventually waves a real one through, and
 * the variable is optional anyway (see the required[] list above) so there is
 * never a reason to set it to a filler value.
 */
function assertNoClientGeminiKey(source, value) {
  if (value && value.trim()) {
    const looksLikePlaceholder = !/^AIza[\w-]{20,}$/.test(value.trim());
    console.error(
      `\nRefusing to build: a Gemini API key is present in ${source}.\n` +
        'Everything this script writes is compiled into the public JS bundle, where anyone\n' +
        'can read it from view-source and spend your Google quota. Note that\n' +
        'useGeminiEdgeFunction: true does NOT protect it — that flag only changes where\n' +
        'calls are routed at runtime, not whether the string is embedded.\n\n' +
        (looksLikePlaceholder
          ? 'The value found does not look like a real key, so this may be a placeholder.\n' +
            'DELETE the variable rather than setting it to a filler value — it is optional,\n' +
            'and the build succeeds with it absent entirely. Only supabaseUrl and\n' +
            'supabaseAnonKey are required.\n\n'
          : '') +
        'Production must call Gemini through the Supabase Edge Functions instead:\n' +
        '  1. delete the geminiApiKey build variable (or clear it in environment.prod.ts)\n' +
        '  2. keep useGeminiEdgeFunction: true\n' +
        '  3. store the key server-side:  supabase secrets set GEMINI_API_KEY=...\n'
    );
    process.exit(1);
  }
}

if (!hasAllEnvVars) {
  if (fs.existsSync(targetPath)) {
    // A hand-maintained local prod env still gets the key check — this is the
    // path that actually produced a leaked key in a build artifact before.
    const existing = fs.readFileSync(targetPath, 'utf8');
    const match = existing.match(/geminiApiKey:\s*'([^']*)'/);
    assertNoClientGeminiKey('src/environments/environment.prod.ts', match && match[1]);
    console.log('environment.prod.ts already exists locally; skipping generation.');
    process.exit(0);
  }
  console.error(
    `environment.prod.ts is missing and required env vars are not set: ${required.join(', ')}.\n` +
      'Either copy src/environments/environment.demo.ts to environment.prod.ts locally and fill it in, ' +
      'or set these env vars on your build host (e.g. Cloudflare Pages project settings).'
  );
  process.exit(1);
}

assertNoClientGeminiKey('the geminiApiKey build environment variable', process.env.geminiApiKey);

// useGeminiEdgeFunction is hardcoded true rather than read from the environment:
// with no client-side key possible, the direct-call path cannot work in a prod
// build anyway, and a stray `useGeminiEdgeFunction=false` would silently ship a
// build whose AI features all fail.
const contents = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.supabaseUrl}',
  supabaseAnonKey: '${process.env.supabaseAnonKey}',
  geminiApiKey: '',
  useGeminiEdgeFunction: true,
};
`;

fs.writeFileSync(targetPath, contents);
console.log('Generated src/environments/environment.prod.ts from environment variables.');

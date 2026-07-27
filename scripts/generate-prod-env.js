// Generates the git-ignored src/environments/environment.prod.ts from environment
// variables. Runs automatically before `npm run build:prod` (see package.json's
// `prebuild:prod`). On a host like Cloudflare Pages that clones a fresh checkout,
// environment.prod.ts doesn't exist yet, so this creates it from the project's
// dashboard-configured env vars. Locally, if you already have your own
// environment.prod.ts, it's left untouched.
const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../src/environments/environment.prod.ts');
const required = ['supabaseUrl', 'supabaseAnonKey'];
const hasAllEnvVars = required.every((key) => process.env[key]);

if (!hasAllEnvVars) {
  if (fs.existsSync(targetPath)) {
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

const contents = `export const environment = {
  production: true,
  supabaseUrl: '${process.env.supabaseUrl}',
  supabaseAnonKey: '${process.env.supabaseAnonKey}',
  geminiApiKey: '${process.env.geminiApiKey || ''}',
  useGeminiEdgeFunction: ${process.env.useGeminiEdgeFunction !== 'false'},
};
`;

fs.writeFileSync(targetPath, contents);
console.log('Generated src/environments/environment.prod.ts from environment variables.');

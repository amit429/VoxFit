// Fails the build if the compiled bundle in www/ contains anything that looks
// like a private credential.
//
// Runs automatically after `npm run build:prod` (see package.json's
// `postbuild:prod`), including on Cloudflare, whose build command is
// `npm run build:prod`.
//
// WHY THIS EXISTS, given generate-prod-env.js already refuses to write a key:
// that script guards one *input* path. This checks the actual *output*, so it
// catches every path — a stale dev bundle left in www/, a key hardcoded in a
// component, an accidentally-committed environment.dev.ts, a future config file
// nobody thought about. It is the check that would have caught the original
// leak, which arrived via `android:prepare:dev` rather than through any env var.
// Takes an optional target directory so the same check covers both shipping
// surfaces: the web bundle in www/, and the copy `cap sync` places in
// android/app/src/main/assets/public/. An APK/AAB is just a zip — a key in
// those assets is as readable as one on a web server, and `android:prepare:dev`
// syncs a dev bundle there routinely.
//   node scripts/scan-bundle-secrets.js [dir]
const fs = require('fs');
const path = require('path');

const WWW = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, '../www');

/**
 * Patterns for credentials that must never reach a client bundle.
 *
 * `supabaseAnonKey` is deliberately NOT here. It is a JWT (eyJ...) and is meant
 * to be public — it authorises nothing on its own, since every table is behind
 * RLS scoped to auth.uid(). Flagging it would train people to ignore this script.
 */
const PATTERNS = [
  { name: 'Google API key (Gemini)', re: /AIza[0-9A-Za-z_-]{20,}/g },
  { name: 'Supabase service_role key', re: /\bservice_role\b/g },
  { name: 'OpenAI API key', re: /\bsk-[A-Za-z0-9]{20,}/g },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
];

/** Text-ish build outputs. Binary assets (images, fonts) can't meaningfully hide a key we'd catch. */
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.json', '.css', '.txt', '.map']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

if (!fs.existsSync(WWW)) {
  console.error(`scan-bundle-secrets: ${WWW} not found — run a build/sync first.`);
  process.exit(1);
}

const findings = [];
for (const file of walk(WWW)) {
  const content = fs.readFileSync(file, 'utf8');
  for (const { name, re } of PATTERNS) {
    const matches = content.match(re);
    if (matches) {
      findings.push({
        file: path.relative(WWW, file),
        name,
        // Never print the credential itself — this output goes to CI logs, which
        // are often broadly readable and retained.
        count: matches.length,
        sample: `${matches[0].slice(0, 6)}…${matches[0].slice(-2)} (${matches[0].length} chars)`,
      });
    }
  }
}

if (findings.length > 0) {
  console.error(
    `\nBUILD BLOCKED — credential-shaped strings found in ${path.relative(process.cwd(), WWW) || '.'}:\n`
  );
  for (const f of findings) {
    console.error(`  ${f.file}`);
    console.error(`    ${f.name} ×${f.count}  ${f.sample}`);
  }
  console.error(
    '\nThis output is publicly readable once deployed. Do not deploy it.\n\n' +
      'Most likely causes:\n' +
      "  - the bundle is a dev build (`npm run android:prepare:dev` writes to www/ AND syncs\n" +
      '    it into the Android assets). Fix: rm -rf www && npm run android:prepare:prod\n' +
      '  - a key is hardcoded in source, or set as a build environment variable.\n' +
      '    Fix: remove it; production reads GEMINI_API_KEY server-side via Edge Functions.\n\n' +
      'Treat any real key found here as compromised and rotate it.\n'
  );
  process.exit(1);
}

console.log(
  `scan-bundle-secrets: clean (${walk(WWW).length} files scanned in ${path.relative(process.cwd(), WWW) || '.'}).`
);

// Validates the built www/.well-known/assetlinks.json before it can be deployed.
//
// Runs as part of `postbuild:prod`. Android's App Links verifier is silent on
// failure: a malformed file, a placeholder fingerprint, or a package-name typo
// doesn't error anywhere — the links simply stop opening in the app and fall
// back to the browser. Since that failure mode also silently reintroduces the
// SEC-11 exposure window (auth links no longer bound to our app), it is worth a
// build-time check rather than discovering it from user reports.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '../www/.well-known/assetlinks.json');
const EXPECTED_PACKAGE = 'com.voxfit.app';
const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

function fail(msg) {
  console.error(`\nBUILD BLOCKED — assetlinks.json is invalid:\n  ${msg}\n`);
  console.error(
    'Android App Links fail silently, so this is checked at build time.\n' +
      'Fix src/.well-known/assetlinks.json and rebuild.\n'
  );
  process.exit(1);
}

if (!fs.existsSync(FILE)) {
  fail('www/.well-known/assetlinks.json is missing — check the asset glob in angular.json.');
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (e) {
  fail(`not valid JSON (${e.message}).`);
}

if (!Array.isArray(parsed) || parsed.length === 0) {
  fail('must be a non-empty JSON array of statements.');
}

for (const [i, statement] of parsed.entries()) {
  const where = `statement[${i}]`;
  const target = statement && statement.target;
  if (!target) fail(`${where} has no "target".`);

  if (!Array.isArray(statement.relation) ||
      !statement.relation.includes('delegate_permission/common.handle_all_urls')) {
    fail(`${where}.relation must include "delegate_permission/common.handle_all_urls".`);
  }
  if (target.namespace !== 'android_app') {
    fail(`${where}.target.namespace must be "android_app" (found ${JSON.stringify(target.namespace)}).`);
  }
  if (target.package_name !== EXPECTED_PACKAGE) {
    fail(
      `${where}.target.package_name is ${JSON.stringify(target.package_name)}, ` +
        `expected "${EXPECTED_PACKAGE}" (must match applicationId in android/app/build.gradle).`
    );
  }

  const prints = target.sha256_cert_fingerprints;
  if (!Array.isArray(prints) || prints.length === 0) {
    fail(`${where}.target.sha256_cert_fingerprints must be a non-empty array.`);
  }
  for (const fp of prints) {
    if (typeof fp !== 'string' || !FINGERPRINT_RE.test(fp)) {
      // Catches leftover REPLACE_WITH_* placeholders as well as truncated or
      // lower-case values, both of which Android rejects without explanation.
      fail(
        `invalid fingerprint ${JSON.stringify(String(fp).slice(0, 24))}…\n` +
          '  Expected 32 upper-case hex pairs separated by colons, e.g. AB:CD:...:EF\n' +
          '  Get it with: keytool -list -v -keystore <your.jks> -alias <alias>'
      );
    }
  }
}

const total = parsed.reduce((n, s) => n + s.target.sha256_cert_fingerprints.length, 0);
console.log(`verify-assetlinks: valid (${parsed.length} statement(s), ${total} fingerprint(s)).`);
if (total === 1) {
  // Not fatal: correct for sideloaded/self-signed distribution, wrong for Play
  // App Signing, and the two are indistinguishable from here.
  console.log(
    'verify-assetlinks: NOTE — only one fingerprint listed. If this app uses Google Play\n' +
      '  App Signing, also add the Play signing certificate SHA-256 from\n' +
      '  Play Console → Test and release → App integrity, or App Links will fail for\n' +
      '  users who installed from the Play Store.'
  );
}

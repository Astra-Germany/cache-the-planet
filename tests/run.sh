#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null
node --check dist/common.js
node --check dist/restore.js
node --check dist/save.js
node --check dist/gc.js
node <<'NODE'
const fs = require('fs');
const os = require('os');
const path = require('path');
const { securityScan: sourceSecurityScan } = require('./src/common');
const { securityScan: distSecurityScan } = require('./dist/common');
const securityScan = (directory) => {
  sourceSecurityScan(directory);
  distSecurityScan(directory);
};
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-security-'));
try {
  const secret = path.join(root, '.env');
  fs.writeFileSync(secret, 'DATABASE_PASSWORD=should-not-be-cached\n');
  let rejected = false;
  try { securityScan(root); } catch { rejected = true; }
  if (!rejected) throw new Error('sensitive filename/content was not rejected');
  fs.rmSync(secret);
  fs.writeFileSync(path.join(root, 'env.py'), 'password = None\n');
  securityScan(root);
  fs.writeFileSync(path.join(root, 'tokens.py'), 'secret = "package-example-value"\n');
  securityScan(root);
  fs.writeFileSync(path.join(root, 'ImageFont.py'), '# Copyright (c) 1997-2003 by Secret Labs AB\n');
  securityScan(root);
  fs.mkdirSync(path.join(root, 'example-1.0.dist-info'));
  fs.writeFileSync(path.join(root, 'example-1.0.dist-info', 'METADATA'), 'Requires-Dist: password-parser\n');
  securityScan(root);
  fs.writeFileSync(path.join(root, 'target.txt'), 'internal target\n');
  fs.symlinkSync('target.txt', path.join(root, 'internal-link'));
  securityScan(root);
  fs.rmSync(path.join(root, 'internal-link'));
  fs.writeFileSync(path.join(root, 'dependency.jar'), Buffer.from('password = "binary-package-data"\0'));
  securityScan(root);
  fs.writeFileSync(path.join(root, 'cacert.pem'), '-----BEGIN CERTIFICATE-----\npublic-ca-certificate\n');
  securityScan(root);
  fs.writeFileSync(path.join(root, 'private.key'), '-----BEGIN PRIVATE KEY-----\nsecret\n');
  rejected = false;
  try { securityScan(root); } catch { rejected = true; }
  if (!rejected) throw new Error('private key was not rejected');
  fs.mkdirSync(path.join(root, '.ssh'));
  fs.writeFileSync(path.join(root, '.ssh', 'config'), 'Host example\n');
  rejected = false;
  try { securityScan(root); } catch { rejected = true; }
  if (!rejected) throw new Error('.ssh directory was not rejected');
  fs.rmSync(path.join(root, '.ssh'), { recursive: true, force: true });
  fs.writeFileSync(path.join(root, 'config.txt'), 'DATABASE_PASSWORD=should-not-be-cached\n');
  rejected = false;
  try { securityScan(root); } catch { rejected = true; }
  if (!rejected) throw new Error('private-key content was not rejected');
  console.log('security scan test passed');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
NODE
if rg -n -i 'actions/cache|cache:[[:space:]]*npm|enable-cache:[[:space:]]*true|cache-image:[[:space:]]*true' .github; then
  echo 'GitHub Actions native cache is disabled but a cache configuration was found'
  exit 1
fi
testdir=$(mktemp -d)
trap 'rm -rf "$testdir"' EXIT
mkdir -p "$testdir/a dir"
printf 'stable\n' > "$testdir/a dir/file.txt"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -cf - -C "$testdir" 'a dir' | zstd -q -o "$testdir/one.tar.zst"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -cf - -C "$testdir" 'a dir' | zstd -q -o "$testdir/two.tar.zst"
test "$(sha256sum "$testdir/one.tar.zst" | cut -d' ' -f1)" = "$(sha256sum "$testdir/two.tar.zst" | cut -d' ' -f1)"
echo 'deterministic archive test passed'

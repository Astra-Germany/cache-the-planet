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
const { securityScan } = require('./src/common');
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

#!/usr/bin/env bash
set -euo pipefail
command -v node >/dev/null
node --check dist/common.js
node --check dist/restore.js
node --check dist/save.js
node --check dist/gc.js
if rg -n -i 'actions/cache|cache:[[:space:]]*npm' .github; then
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

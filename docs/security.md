# Security

Cache data is untrusted input. Before an archive is created, the action rejects:

- symlinks;
- paths outside `GITHUB_WORKSPACE`;
- sensitive-looking names or directories such as `.env*` (but not normal source files like `env.py` or `tokens.py`), `.npmrc`, `.netrc`, `.ssh`, `.aws`, `.docker`, `.kube`, `credentials*`, `*secret*`, `*token*`, `*password*`, SSH private keys and `*.pem`/`*.key`/`*.p12`/`*.pfx`;
- common private-key and known-token patterns in text files up to 1 MiB, plus generic credential assignments in non-source text files. Known binary/archive formats such as JAR, ZIP, WAR and AAR are not decoded as text, preventing false positives from binary package data. Normal package source code is not rejected merely because it contains variables such as `password`, `secret` or `api_key`.

This is a defense-in-depth check, not a secret scanner. Keep cache paths narrow, use `exclude`, and never put a workspace containing production credentials into a cache path. Downloads are verified by SHA-256 and archives reject traversal paths.

Trusted references can only be written from `main` or a tag. Pull-request references must use `untrusted/<repository>/pr-<number>/...`; they are removed when the PR closes. Fork pull requests cannot save unless the workflow explicitly and safely provides the required permission/token. A cache hit is not proof of provenance; builds must not execute arbitrary cached binaries without their own trust controls.

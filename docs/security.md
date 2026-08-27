# Security

Cache data is untrusted input. Before an archive is created, the action rejects:

- symlinks;
- paths outside `GITHUB_WORKSPACE`;
- sensitive-looking names or directories such as `.env*` (but not normal source files like `env.py` or `tokens.py`), `.npmrc`, `.netrc`, `.ssh`, `.aws`, `.docker`, `.kube`, `credentials*`, `*secret*`, `*token*`, `*password*`, SSH private keys and `*.pem`/`*.key`/`*.p12`/`*.pfx`;
- common private-key, token and credential string-value patterns in text files up to 1 MiB. Known binary/archive formats such as JAR, ZIP, WAR and AAR are not decoded as text, preventing false positives from binary package data. Type annotations and normal source expressions such as `password: str` or `password = None` are intentionally allowed to avoid rejecting package source code.

This is a defense-in-depth check, not a secret scanner. Keep cache paths narrow, use `exclude`, and never put a workspace containing production credentials into a cache path. Downloads are verified by SHA-256 and archives reject traversal paths.

Trusted references can only be written from `main` or a tag. Pull-request references must use `untrusted/<repository>/pr-<number>/...`; they are removed when the PR closes. Fork pull requests cannot save unless the workflow explicitly and safely provides the required permission/token. A cache hit is not proof of provenance; builds must not execute arbitrary cached binaries without their own trust controls.

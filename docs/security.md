# Security

Cache data is untrusted input. Before an archive is created, the action rejects:

- symlinks;
- paths outside `GITHUB_WORKSPACE`;
- sensitive-looking names or directories such as `.env*` (but not normal files like `env.py`), `.npmrc`, `.netrc`, `.ssh`, `.aws`, `.docker`, `.kube`, `credentials*`, `*secret*`, `*token*`, `*password*`, SSH private keys and `*.pem`/`*.key`/`*.p12`/`*.pfx`;
- common private-key, token and credential-value patterns in regular files up to 1 MiB. Short variable names or values such as `password = None` are intentionally allowed to avoid rejecting normal package source code.

This is a defense-in-depth check, not a secret scanner. Keep cache paths narrow, use `exclude`, and never put a workspace containing production credentials into a cache path. Downloads are verified by SHA-256 and archives reject traversal paths.

Trusted references can only be written from `main` or a tag. Pull-request references must use `untrusted/<repository>/pr-<number>/...`; they are removed when the PR closes. Fork pull requests cannot save unless the workflow explicitly and safely provides the required permission/token. A cache hit is not proof of provenance; builds must not execute arbitrary cached binaries without their own trust controls.

# Security

Cache data is untrusted input. Do not cache `.env`, SSH keys, API keys, npm/pip/Docker credentials, GitHub tokens, or `credentials*`; use `exclude` and review paths. Downloads are verified by SHA-256 and archives reject traversal paths.

Fork pull requests never write references. Use separate `trusted/` and `untrusted/` key namespaces if untrusted caches are needed. A cache hit is not proof of provenance; builds must not execute arbitrary cached binaries without their own trust controls.

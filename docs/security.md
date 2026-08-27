# Security

## Token für das Cache-Repository

Bei einem separaten Cache-Repository benötigt der Workflow ein Token mit minimalen Schreibrechten auf dieses Repository. Ein Fine-grained PAT wird im Benutzerkonto erstellt, aber als Secret im Anwendungs-Repository gespeichert, zum Beispiel:

```text
Secret-Name: CACHE_APP_TOKEN
Repository: spdf-cache → Settings → Secrets and variables → Actions
PAT-Zugriff: Ludy87/cache-the-planet
PAT-Rechte: Contents/Code Read and write, Metadata Read-only
```

Im Workflow:

```yaml
token: ${{ secrets.CACHE_APP_TOKEN }}
```

Wenn `token` nicht angegeben wird, verwendet die Action standardmäßig `GITHUB_TOKEN` beziehungsweise `ACTIONS_RUNTIME_TOKEN`. Dieser Fallback kann deaktiviert werden:

```yaml
use-default-token: false
```

Ein explizit gesetzter `token` hat immer Vorrang. Wird der Fallback deaktiviert und kein Token gesetzt, schlagen API-Zugriffe wegen fehlender Authentifizierung fehl.

Kein dauerhaft gültiges Token ohne Ablaufdatum und kein Fallback auf `github.token` verwenden. Fork-Pull-Requests dürfen keine Schreib-Secrets erhalten; der Save-Schritt bleibt für sie deaktiviert.

## Optionale Cache-Verschlüsselung

Mit `encryption-key` werden komprimierte Archive vor dem Upload mit AES-256-GCM verschlüsselt. Restore und Save müssen denselben Schlüssel verwenden:

```yaml
encryption-key: ${{ secrets.CACHE_ENCRYPTION_KEY }}
```

Empfohlen wird ein zufälliger 64-stelliger Hex-Schlüssel. Eine Passphrase ist ebenfalls möglich. Ohne Schlüssel oder mit einem falschen Schlüssel schlägt Restore kontrolliert fehl. Der Schlüssel darf nicht an Fork-Pull-Requests weitergegeben werden.

Cache data is untrusted input. Before an archive is created, the action rejects:

- external symlinks; relative symlinks whose targets remain inside the cache path are allowed and dereferenced into the archive;
- paths outside `GITHUB_WORKSPACE`;
- sensitive-looking names or directories such as `.env*` (but not normal source files like `env.py` or `tokens.py`), `.npmrc`, `.netrc`, `.ssh`, `.aws`, `.docker`, `.kube`, `credentials*`, `*secret*`, `*token*`, `*password*`, SSH private keys and `*.key`/`*.p12`/`*.pfx`. Public CA certificates such as `cacert.pem` are allowed; PEM private keys are rejected by their content.
- private-key patterns in all text files up to 1 MiB; known-token patterns and generic credential assignments are checked only in non-source/non-package-metadata text files. Token patterns require a realistic token length to avoid matching ordinary package text. Entire Python package metadata directories such as `*.dist-info` and `*.egg-info` are allowed because dependency names, hashes and descriptions can contain credential-related words. Known binary/archive formats such as JAR, ZIP, WAR and AAR are not decoded as text, preventing false positives from binary package data. Normal package source code is not rejected merely because it contains variables such as `password`, `secret` or `api_key`.

This is a defense-in-depth check, not a secret scanner. Keep cache paths narrow, use `exclude`, and never put a workspace containing production credentials into a cache path. Downloads are verified by SHA-256 and archives reject traversal paths.

Trusted references can only be written from `main` or a tag. Pull-request references must use `untrusted/<repository>/pr-<number>/...`; they are removed when the PR closes. Fork pull requests cannot save unless the workflow explicitly and safely provides the required permission/token. A cache hit is not proof of provenance; builds must not execute arbitrary cached binaries without their own trust controls.

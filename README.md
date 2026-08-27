# GitHub Actions Content Cache

Ein zentraler, content-addressed Cache für GitHub Actions. Dieses Repository `Ludy87/cache-the-planet` enthält sowohl die wiederverwendbare Action als auch den zentralen Cache-Speicher und kann von mehreren Anwendungs-Repositories verwendet werden.

Die eigentlichen Cache-Dateien werden nicht in Git-Commits gespeichert. Stattdessen liegen sie als immutable GitHub-Release-Assets vor. Eine kleine Manifest-Datei verwaltet die veränderlichen logischen Cache-Keys.

## Inhaltsverzeichnis

1. [Funktionsweise](#funktionsweise)
2. [Repository anlegen](#repository-anlegen)
3. [Action in ein Projekt einbauen](#action-in-ein-projekt-einbauen)
4. [Authentifizierung](#authentifizierung)
5. [GitHub-App einrichten](#github-app-einrichten)
6. [Cache-Keys entwerfen](#cache-keys-entwerfen)
7. [Inputs und Outputs](#inputs-und-outputs)
8. [Restore- und Save-Lifecycle](#restore--und-save-lifecycle)
9. [Sicherheit](#sicherheit)
10. [Garbage Collection](#garbage-collection)
11. [Installation und Versionierung](#installation-und-versionierung)
12. [Troubleshooting](#troubleshooting)
13. [Limitierungen](#limitierungen)

## Funktionsweise

Ein Cache besteht aus zwei getrennten Ebenen.

### Immutable Objects

Nach dem Packen wird das Archiv deterministisch mit `tar` erstellt und mit `zstd` komprimiert. Der SHA-256-Hash wird über die fertigen komprimierten Bytes berechnet.

```text
sha256:93ae271c...
```

Das Objekt wird als Release Asset mit folgendem Namen gespeichert:

```text
93ae271c....tar.zst
```

Ein bereits vorhandenes Objekt wird niemals überschrieben. Wenn zwei Workflows denselben Inhalt gleichzeitig speichern, erzeugen beide denselben Hash; nur einer muss das Asset erfolgreich hochladen.

### Mutable References

Ein logischer Key zeigt auf ein immutable Objekt:

```json
{
  "schema_version": 1,
  "references": {
    "example-org/example-app/linux/amd64/python/3.13/main/v1": {
      "object": "sha256:93ae271c...",
      "updated_at": "2026-08-27T12:00:00Z"
    }
  }
}
```

Die Datei liegt im Cache-Repository unter:

```text
manifests/references-v1.json
```

Sie wird beim ersten Save automatisch erstellt. Das Manifest enthält nur Metadaten und keine großen Cache-Dateien.

## Repository anlegen

### 1. Cache-Repository erstellen

Erstelle ein eigenes Repository, zum Beispiel:

```text
Ludy87/cache-the-planet
```

Empfohlene Einstellungen:

- Für private Abhängigkeiten: Repository privat erstellen.
- Keine großen Binärdateien committen.
- Branch `main` anlegen.
- Branch Protection für `main` aktivieren.
- Actions im Repository aktivieren.
- Nur vertrauenswürdige Personen dürfen Workflows mit Schreibrechten ändern.

Das Repository mit dieser Action muss nicht in jedem Anwendungs-Repository ausgecheckt werden. GitHub lädt `action.yml` und `dist/` direkt aus dem Action-Repository.

### 2. Action-Repository veröffentlichen

Dieses Repository selbst sollte beispielsweise unter folgendem Namen veröffentlicht werden:

```text
Ludy87/cache-the-planet
```

Die Struktur muss erhalten bleiben:

```text
cache-the-planet/
├── action.yml              # Restore-Action
├── save/action.yml         # Save-Action
├── src/                    # Wartbarer Quellcode
├── dist/
│   ├── common.js
│   ├── restore.js
│   ├── save.js
│   └── gc.js
├── scripts/
├── manifests/
├── docs/
└── .github/workflows/
```

GitHub Actions führt die Dateien aus `dist/` aus. Der wartbare Quellcode liegt in `src/`; Änderungen sollten dort vorgenommen werden. Mit `esbuild` wird `src/` automatisch gebündelt und für die Action minifiziert:

```bash
npm install
npm run build
```

Der Workflow `build-dist.yml` baut `dist/` bei Änderungen an `src/` automatisch und committed die generierten Dateien nach `main`. Der Testworkflow prüft zusätzlich, dass `dist/` mit dem Source-Code übereinstimmt. Deshalb müssen Änderungen an der Action nicht mehr direkt in `dist/` gepflegt werden.

Der automatisch erzeugte Commit `chore: build action dist` wird mit `GITHUB_TOKEN` gepusht. GitHub startet für solche Pushes absichtlich keine weiteren `push`-Workflows. Der Testworkflow reagiert deshalb zusätzlich auf das erfolgreiche Ende von `Build action distribution` über `workflow_run`.

Dasselbe gilt für automatisch erzeugte Commits wie `cache: update ...`: Sie entstehen innerhalb des Docker-Cache-Workflows und starten wegen `GITHUB_TOKEN` keinen neuen `push`-Lauf. Der Testworkflow reagiert deshalb auch auf das erfolgreiche Ende von `Docker cache integration`. Soll ein direkter `push`-Workflow auf den Manifest-Commit ausgelöst werden, muss für den Schreibvorgang ein GitHub-App-Installation-Token oder Fine-grained PAT verwendet werden. Die Workflows dieses Repositorys aktivieren bewusst kein `cache: npm` und keine `actions/cache`; Cache-Daten werden ausschließlich über die eigenen Release-Assets gespeichert.

Veröffentliche anschließend einen unveränderlichen Release-Tag, zum Beispiel `v1`:

```bash
git add .
git commit -m "Add content addressed cache action"
git push origin main
git tag -a v1 -m "Cache action v1"
git push origin v1
```

Produktions-Workflows sollten einen Major-Tag wie `@v1` verwenden. Nach kompatiblen Bugfixes kann dieser Tag auf einen neuen Commit zeigen. Für maximale Reproduzierbarkeit kann stattdessen ein vollständiger Commit-SHA verwendet werden.

### 3. Cache-Release vorbereiten

Das Release `cache-v1` wird beim ersten Save automatisch über die GitHub API erstellt. Es ist ein Pre-Release und enthält ausschließlich Cache-Assets.

Alternativ kann es vorher manuell erstellt werden:

```text
Tag: cache-v1
Name: Cache objects (v1)
Pre-release: aktiviert
```

## Action in ein Projekt einbauen

### Minimaler Workflow

Im Anwendungs-Repository wird zuerst restored, anschließend gebaut und am Ende nur bei erfolgreichem Build gespeichert:

```yaml
name: Build

on:
  push:
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Restore cache
        id: cache
        uses: Ludy87/cache-the-planet@v1
        with:
          repository: Ludy87/cache-the-planet
          key: ${{ github.repository }}/linux/amd64/python/3.13/${{ github.ref_name }}/${{ hashFiles('uv.lock') }}/v1
          restore-keys: |
            ${{ github.repository }}/linux/amd64/python/3.13/${{ github.ref_name }}/
            ${{ github.repository }}/linux/amd64/python/3.13/main/
            ${{ github.repository }}/linux/amd64/python/3.13/
          path: |
            ~/.cache/pip
            .venv
          token: ${{ secrets.CACHE_APP_TOKEN }}

      - name: Build
        run: ./build.sh

      - name: Save cache
        if: success() && github.event_name != 'pull_request'
        uses: Ludy87/cache-the-planet/save@v1
        with:
          repository: Ludy87/cache-the-planet
          key: ${{ github.repository }}/linux/amd64/python/3.13/${{ github.ref_name }}/${{ hashFiles('uv.lock') }}/v1
          path: |
            ~/.cache/pip
            .venv
          token: ${{ secrets.CACHE_APP_TOKEN }}
          exclude: |
            **/.env
            **/*.pem
            **/credentials*
```

Der Ausdruck `github.repository` enthält bereits Owner und Repository und verhindert Kollisionen zwischen Projekten. Für private Cache-Repositories sollte ein App-Token verwendet werden; die Einrichtung steht im Abschnitt [GitHub-App einrichten](#github-app-einrichten).

### Einmaliger Lifecycle statt zweier Schritte

Restore und Save sind absichtlich getrennte Actions. Dadurch kann der Save-Schritt mit `if: success()` gezielt erst nach einem erfolgreichen Build ausgeführt werden. Ein Cache wird nicht gespeichert, wenn der Build fehlgeschlagen ist.

Der Restore-Schritt verändert bei einem Miss den Build nicht, solange `strict: false` gesetzt ist oder der Default verwendet wird.

## Authentifizierung

Es gibt drei mögliche Token-Varianten:

| Token | Geeignet für | Empfehlung |
|---|---|---|
| `GITHUB_TOKEN` | Gleiches Repository oder passende Organisationsrichtlinien | Einfach, aber Cross-Repository oft eingeschränkt |
| Fine-grained PAT | Kleine persönliche oder prototypische Setups | Nur als Übergangslösung |
| GitHub App Installation Token | Zentrales Cache-Repository für mehrere Projekte | Empfohlen |

Das Token wird niemals in Cache-Dateien gespeichert. Es wird nur zur GitHub API und zur Release-Asset-API übertragen.

### Benötigte Berechtigungen

Die GitHub App benötigt im Cache-Repository minimal:

```text
Contents: Read and write
Metadata: Read-only
```

Im Anwendungs-Repository braucht die Action selbst keine Schreibrechte. Der Workflow muss nur das Secret lesen dürfen.

## GitHub-App einrichten

### 1. App erstellen

Öffne in der Organisation:

```text
Settings → Developer settings → GitHub Apps → New GitHub App
```

Setze:

- Einen eindeutigen Namen, zum Beispiel `central-actions-cache`.
- Keine Webhook-Berechtigung, sofern keine Webhooks benötigt werden.
- `Contents: Read and write`.
- `Metadata: Read-only`.
- Installation nur in der eigenen Organisation.

Installiere die App anschließend ausschließlich auf `Ludy87/cache-the-planet`.

### 2. Private Key und IDs hinterlegen

Lege die folgenden Werte als Organization- oder Repository-Secrets in den Anwendungs-Repositories an:

```text
CACHE_APP_ID             # App ID
CACHE_APP_PRIVATE_KEY    # Inhalt der erzeugten .pem-Datei
CACHE_APP_INSTALLATION_ID
```

Die Private Key-Datei darf niemals committed oder in Logs ausgegeben werden.

### 3. Installation Token im Workflow erzeugen

Verwende die offizielle Action zum Erzeugen eines kurzlebigen Installation Tokens:

```yaml
- name: Create cache installation token
  id: cache-token
  uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ secrets.CACHE_APP_ID }}
    private-key: ${{ secrets.CACHE_APP_PRIVATE_KEY }}
    owner: Ludy87
    repositories: cache-the-planet

- name: Restore cache
  uses: Ludy87/cache-the-planet@v1
  with:
    repository: Ludy87/cache-the-planet
    token: ${{ steps.cache-token.outputs.token }}
    key: ${{ github.repository }}/linux/amd64/node/${{ hashFiles('package-lock.json') }}/v1
    path: ~/.npm
```

Installation Tokens sind kurzlebig und sollten nicht als dauerhafte Secrets gespeichert werden. Die App selbst darf nur auf das Cache-Repository installiert sein.

## Cache-Keys entwerfen

Ein Key ist eine logische Adresse, nicht der Content-Hash. Empfohlenes Format:

```text
<owner>/<repository>/<os>/<architecture>/<runtime>/<runtime-version>/<branch>/<dependency-hash>/<cache-version>
```

Beispiel:

```text
my-org/my-project/linux/amd64/python/3.13/main/a81f207/v2
```

Sinnvolle Bestandteile:

- `owner/repository`: verhindert Cross-Project-Kollisionen.
- `os` und `architecture`: verhindert inkompatible Artefakte.
- Runtime und Runtime-Version: zum Beispiel `python/3.13` oder `node/22`.
- Branch oder Trust-Namespace: trennt `main`, Release-Branches und PRs.
- Lockfile-, Dockerfile- oder Compiler-Hash: invalidiert den Cache bei Toolchain-Änderungen.
- Cache-Version: manuelle globale Invalidierung, zum Beispiel `v2`.

Für untrusted Pull Requests sollten Keys zusätzlich so aussehen:

```text
untrusted/pr-123/my-org/my-project/linux/amd64/v1
```

Trusted Branches verwenden dagegen:

```text
trusted/main/my-org/my-project/linux/amd64/v1
```

### Restore-Key-Reihenfolge

Die Action sucht in dieser Reihenfolge:

1. Exakter Key.
2. Die angegebenen `restore-keys` von oben nach unten.
3. Innerhalb eines Prefixes den zuletzt aktualisierten Reference-Eintrag.
4. Kein Cache.

Branch- und Default-Branch-Fallback werden durch die Reihenfolge der Prefixe modelliert. Die Action gibt `matched-key` aus, damit der tatsächlich verwendete Cache sichtbar ist.

## Inputs und Outputs

### Restore-Inputs

| Input | Pflicht | Beschreibung |
|---|---:|---|
| `repository` | ja | Cache-Repository im Format `owner/name` |
| `key` | ja | Exakter logischer Cache-Key |
| `restore-keys` | nein | Mehrere Prefixe, jeweils eine Zeile |
| `path` | ja | Eine oder mehrere Dateien/Verzeichnisse, jeweils eine Zeile |
| `compression-level` | nein | zstd-Level, Standard `3` |
| `token` | nein | Token; alternativ `GITHUB_TOKEN` |
| `strict` | nein | `true` bricht bei Cache-Fehlern ab, Standard `false` |

### Save-Inputs

Zusätzlich zu `repository`, `key`, `path`, `compression-level`, `token` und `strict`:

| Input | Beschreibung |
|---|---|
| `exclude` | Ausschlussmuster, jeweils eine Zeile; zum Beispiel `**/.env` |

### Outputs

| Output | Beschreibung |
|---|---|
| `cache-hit` | `true`, wenn der exakte Key restauriert wurde |
| `matched-key` | Tatsächlich verwendeter Key |
| `content-hash` | SHA-256 des komprimierten Objekts |
| `cache-size` | Größe des komprimierten Archivs in Bytes |

Beispiel:

```yaml
- run: |
    echo "Exact hit: ${{ steps.cache.outputs.cache-hit }}"
    echo "Matched key: ${{ steps.cache.outputs.matched-key }}"
    echo "Object: ${{ steps.cache.outputs.content-hash }}"
```

## Deterministische Archive

Die Action verwendet stabile Tar-Einstellungen für:

- alphabetische Dateireihenfolge,
- feste Timestamps,
- UID/GID `0`,
- numerische Owner,
- relative Pfade,
- zstd-Kompression.

Temporäre Dateien sollten vor dem Save entfernt werden. Pfade mit Leerzeichen werden unterstützt, sofern sie jeweils als eigene Zeile im `path`-Input stehen.

## Sicherheit

Caches sind grundsätzlich nicht vertrauenswürdig. Niemals automatisch in den Cache aufnehmen:

```text
.env
SSH private keys
API keys
npm tokens
pip credentials
Docker config.json
GitHub tokens
credentials files
```

Nutze zum Ausschließen:

```yaml
exclude: |
  **/.env
  **/*.pem
  **/*secret*
  **/credentials*
  **/.docker/config.json
```

Beim Restore wird:

1. das Release-Asset heruntergeladen,
2. der SHA-256-Hash mit der Reference verglichen,
3. das Tar-Archiv auf absolute und `..`-Pfade geprüft,
4. erst danach extrahiert.

Fork-Pull-Requests speichern standardmäßig nichts. Für besonders sensible Projekte sollten zusätzlich getrennte `trusted`- und `untrusted`-Namespaces eingesetzt werden. Vor dem Packen verweigert die Action außerdem Symlinks, Pfade außerhalb des Workspace, typische Credential-Dateinamen sowie erkannte Private-Key-/Token-Muster in kleinen Textdateien. Diese Prüfung ist Defense-in-Depth und ersetzt keine engen Cache-Pfade oder `exclude`-Regeln.

Für interne Pull Requests kann ein eigener, automatisch löschbarer PR-Cache aktiviert werden:

```yaml
- name: Save PR cache
  if: success() && github.event_name == 'pull_request'
  uses: Ludy87/cache-the-planet/save@v1
  with:
    repository: Ludy87/cache-the-planet
    token: ${{ secrets.CACHE_APP_TOKEN }}
    allow-pr-cache: true
    key: untrusted/${{ github.repository }}/pr-${{ github.event.pull_request.number }}/linux-amd64/v1
    path: .cache/build
```

Der Key muss mit `untrusted/<repository>/pr-<number>/` beginnen. Beim Event `pull_request: closed` entfernt [pr-cache-cleanup.yml](.github/workflows/pr-cache-cleanup.yml) die PR-References und die dadurch nicht mehr referenzierten Release Assets. Für Fork-Pull-Requests bleibt das Speichern deaktiviert, weil dort keine Schreib-Secrets an untrusted Code gegeben werden sollten.

## Garbage Collection

Ein Objekt darf entfernt werden, wenn:

- keine Reference mehr darauf zeigt,
- es älter als die Grace Period ist.

Standardmäßig beträgt die Grace Period sieben Tage. Zuerst immer Dry-Run ausführen:

```bash
CACHE_REPOSITORY=Ludy87/cache-the-planet \
GITHUB_TOKEN="$TOKEN" \
GRACE_DAYS=7 \
node dist/gc.js --dry-run
```

Ein tatsächlicher Lauf:

```bash
CACHE_REPOSITORY=Ludy87/cache-the-planet \
GITHUB_TOKEN="$TOKEN" \
GRACE_DAYS=7 \
DRY_RUN=false \
node dist/gc.js
```

Der mitgelieferte Workflow `.github/workflows/cleanup.yml` läuft täglich um 03:00 UTC. Vor dem produktiven Aktivieren sollte der Workflow so angepasst werden, dass `DRY_RUN=false` nur nach einer bewussten Freigabe gesetzt wird.

## Installation und Versionierung

Im Client-Repository genügt die Referenz auf den Release-Tag:

```yaml
uses: Ludy87/cache-the-planet@v1
```

Für die Save-Action:

```yaml
uses: Ludy87/cache-the-planet/save@v1
```

Bei inkompatiblen Protokolländerungen wird ein neuer Namespace wie `cache-v2` und eine neue Major-Version wie `@v2` verwendet. V1-Clients können alte V1-Objekte weiter lesen, solange das Manifest und das Release bestehen bleiben.

## Lokale Entwicklung und Tests

Voraussetzungen auf dem Runner:

```text
Node.js 24
GNU tar
zstd
```

Tests unter Ubuntu:

```bash
bash tests/run.sh
```

Die Tests prüfen JavaScript-Syntax, deterministische Archive und stellen sicher, dass kein `actions/cache`, `cache: npm`, `setup-uv`-`enable-cache: true` oder `setup-qemu`-`cache-image: true` aktiviert ist. API-Tests sollten gegen ein eigenes Test-Cache-Repository mit einem kurzlebigen Token ausgeführt werden.

## Troubleshooting

### `404 Not Found` beim Release

Prüfe:

- `repository` ist wirklich `owner/name`.
- Das Token hat `Contents: read`.
- Das Repository ist für die App installiert.
- Das Release `cache-v1` darf erstellt werden, falls es noch nicht existiert.

### `403 Resource not accessible by integration`

Das Token hat keine Schreibrechte auf das Cache-Repository. Prüfe die Installation der GitHub App und `Contents: Read and write`.

### Cache bleibt immer ein Miss

Prüfe `matched-key`, `content-hash` und die Release-Assets. Häufige Ursachen sind:

- unterschiedlicher Lockfile-Hash,
- anderer Namespace,
- fehlender Slash am Ende eines Prefixes,
- unterschiedliche Runtime-Version,
- Reference zeigt auf ein gelöschtes Asset.

### `tar and zstd are required`

Die Action erwartet diese Programme auf dem Runner. Auf `ubuntu-latest` sind sie normalerweise verfügbar. Bei selbst gehosteten Runnern müssen sie installiert und im `PATH` verfügbar sein.

### Upload liefert HTTP 422

Wenn das Asset denselben Namen bereits besitzt, wird HTTP 422 als erfolgreicher Deduplication-Fall behandelt. Andere Upload-Fehler werden abhängig von `strict` als Miss behandelt oder lösen den Workflow-Fehler aus.

### Manifest-Konflikt

References werden mit der Contents-SHA gelesen und bei Konflikten bis zu fünfmal wiederholt. Häufige Konflikte sind bei parallelen Saves normal. Bei dauerhaftem Fehler sollten Token-Rechte, Branch Protection und die Default-Branch-Konfiguration geprüft werden.

## Limitierungen

- GitHub Release-Asset-Limits und API-Limits gelten.
- Ein einzelnes Manifest ist für tausende Keys geeignet; bei sehr vielen zehntausend Keys sollte es nach Namespace geshardet werden.
- Die Action implementiert keine globale Branch-Policy. Trust-Level müssen über Key-Namespaces und Workflow-Berechtigungen festgelegt werden.
- Cache-Fehler werden standardmäßig als Miss behandelt. Für reproduzierbare oder sicherheitskritische Builds `strict: true` verwenden.
- Der Cache ersetzt keine Artefaktablage für signierte Releases oder vertrauenswürdige Binärdistributionen.

## Weitere Dokumentation

- Ein ausführbares Docker-Beispiel befindet sich unter [examples/docker-cache](examples/docker-cache).
- Der End-to-End-Testworkflow ist [.github/workflows/docker-cache-integration.yml](.github/workflows/docker-cache-integration.yml).
- Der Node/npm-Asset-Test ist [.github/workflows/node-cache-integration.yml](.github/workflows/node-cache-integration.yml).
- Der uv-Asset-Test ist [.github/workflows/uv-cache-integration.yml](.github/workflows/uv-cache-integration.yml). Er verwendet `astral-sh/setup-uv` ausschließlich zur Installation und deaktiviert dessen nativen Cache.
- Der Task-Asset-Test ist [.github/workflows/task-cache-integration.yml](.github/workflows/task-cache-integration.yml). `go-task/setup-task` selbst besitzt keinen nativen Cache; getestet wird der von `task` erzeugte Build-Cache.
- Der Java/Maven-Asset-Test ist [.github/workflows/java-cache-integration.yml](.github/workflows/java-cache-integration.yml). `actions/setup-java` wird ohne `cache`-Input verwendet; das Maven-Repository wird nach `.cache/m2` umgeleitet und als Release Asset gespeichert.
- [Architektur](docs/architecture.md)
- [Security](docs/security.md)
- [Protokoll v1](docs/protocol.md)

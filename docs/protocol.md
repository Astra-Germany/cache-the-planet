# Protokoll v1

## Datenmodell

Ein Cache-Objekt wird als komprimiertes und optional verschlüsseltes
`tar.zst`-Archiv im Pre-Release `cache-v1` gespeichert. Der Objekt-Hash ist
der SHA-256-Hash der tatsächlich gespeicherten Bytes. Dadurch werden auch
verschlüsselte Objekte eindeutig identifiziert.

Der physische Asset-Name enthält zusätzlich den lesbaren Cache-Key:

```text
<cache-key>--<64-stelliger-sha256-hash>.tar.zst
```

Der Hash bleibt die maßgebliche Identität; der lesbare Teil dient nur der
Zuordnung und darf nicht als Vertrauensnachweis verwendet werden.

Das Manifest liegt im Cache-Repository unter
`manifests/references-v1.json`:

```json
{"schema_version":1,"references":{"key":{"object":"sha256:<64 hex>","updated_at":"RFC3339"}}}
```

`key` wird intern als vollständiger, automatisch abgegrenzter Schlüssel
gespeichert. Nutzer dürfen in `key` nur den logischen Key angeben; der
 Namespace wird über `scope` bestimmt. In `restore-keys` darf zusätzlich ein
 `shared/<owner>/<repository>/`-Prefix oder ein vollständiger `shared/...`-
 Prefix als geprüfter Fallback angegeben werden.
`trusted/...` und `untrusted/...` sind dort weiterhin nicht erlaubt.
Bei `scope: auto` werden logische Restore-Prefixe zuerst als `shared` und
danach als `trusted` bzw. bei Pull Requests als `untrusted` ausgewertet.
Shared-Restore in Pull Requests erfordert weiterhin
`allow-shared-restore: true`.
Vertrauenswürdige Schlüssel verwenden das Schema
`trusted/<owner>/<repository>/<default-branch>/<cache-name>/<logical-key>/v1`.
Pull-Request-Schlüssel verwenden
`untrusted/<owner>/<repository>/pr-<number>/<cache-name>/<logical-key>/v1`.

Geprüfte Basis-Caches können unter
`shared/<owner>/<repository>/<cache-name>/<logical-key>/v1` veröffentlicht werden.
Sie dürfen nur aus `main` oder Release-Tags geschrieben werden. Pull Requests
benötigen für deren Restore den expliziten Schalter
`allow-shared-restore: true`.

Clients können den vollständigen Namespace automatisch aus `scope` erzeugen.
Erlaubte Werte sind `auto`, `shared`, `trusted` und `untrusted`. Bei `auto`
wird für Pull Requests `untrusted` und für Pushes bzw. Tags `trusted` gewählt.
Der logische Key enthält dabei nur Cache-Name, Plattform, Hash und Version.
Wird die Plattform im logischen Key weggelassen, ergänzt die Action automatisch
`RUNNER_OS` und `RUNNER_ARCH`; fehlende Werte werden als `unknown` eingesetzt.
Die Komponenten können mit `os`, `arch` und `version` explizit überschrieben
werden. Der Nutzer-Key kann dadurch ausschließlich aus dem Abhängigkeits-Hash
bestehen.
`version` ist numerisch und wird als `v<version>` im vollständigen Key
gespeichert.
Wird `scope: shared` in einem Pull Request verwendet, wird er automatisch mit
einem Hinweis in `untrusted/.../pr-<number>/...` umgewandelt. Dadurch bleibt
der Pull Request isoliert; auf `main` wird derselbe logische Key wieder als
Shared-Key erzeugt.

Clients müssen unbekannte Felder ignorieren und `schema_version` erhalten. Ein
fehlendes Objekt, ein ungültiger Hash, eine fehlende Referenz oder ein
beschädigtes Archiv gilt als Cache-Miss. Bei `strict: true` wird stattdessen
der Fehler an den Workflow weitergegeben.

Beim Restore wird zuerst der Hash des heruntergeladenen Assets geprüft. Danach
wird das Archiv bei Bedarf entschlüsselt, dekomprimiert, auf Pfadüberquerungen,
Links und spezielle Dateitypen geprüft und erst anschließend in den Workspace
entpackt.

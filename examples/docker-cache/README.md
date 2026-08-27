# Docker-Cache-Beispiel

Dieses Beispiel verwendet Docker Buildx mit einem lokalen Cache-Verzeichnis:

```text
examples/docker-cache/.cache/docker-buildx
```

Der Ordner wird vom Workflow nicht committed. Die Cache-Action packt ihn nach dem Build als deterministisches `tar.zst`-Objekt und speichert ihn als Release Asset im Cache-Repository.

Für ein echtes Projekt kann der Inhalt dieses Ordners durch einen beliebigen Docker-BuildKit-Cache ersetzt werden.

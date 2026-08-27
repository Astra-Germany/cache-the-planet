# go-task-Cache-Beispiel

`go-task/setup-task` installiert nur das `task`-Binary und verwendet keinen eigenen GitHub-Actions-Cache. Das `Taskfile.yml` baut aus `src/input.txt` ein Artefakt unter `.cache/task/build/output.txt`. Dieses Build-Verzeichnis wird ausschließlich über die Content-Addressed-Asset-Action gespeichert und in einem frischen Job von `Taskfile.yml` verifiziert.

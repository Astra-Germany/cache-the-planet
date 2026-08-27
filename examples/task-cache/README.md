# go-task-Cache-Beispiel

`go-task/setup-task` installiert nur das `task`-Binary und verwendet keinen eigenen GitHub-Actions-Cache. Der Workflow demonstriert deshalb einen von `task` erzeugten Build-Cache unter `.cache/task`, der ausschließlich über die Content-Addressed-Asset-Action gespeichert wird.

# uv-Cache-Beispiel

Der uv-Cache wird mit `cache-local-path: .cache/uv` in den Workspace umgeleitet. `enable-cache` bleibt deaktiviert, damit `astral-sh/setup-uv` keinen nativen GitHub-Actions-Cache verwendet. `actions/setup-python` stellt die Python-Laufzeit bereit; sein optionales `cache: pip` bleibt ebenfalls deaktiviert. Der Workflow prüft diese Kombination in einem frischen Job.

Die separate Integration `uv-python-cache-asset-integration.yml` testet zusätzlich uv-managed Python mit `UV_CACHE_DIR`, `UV_PYTHON_CACHE_DIR` und `UV_PYTHON_INSTALL_DIR`. Als Release-Asset wird nur `.cache/uv` gecacht; `UV_PYTHON_CACHE_DIR` liegt darin und speichert die Python-Downloads. Das Installationsverzeichnis von uv-managed Python wird nicht archiviert, weil uv darin versionsabhängige Links verwaltet, die beim sicheren Archivieren nicht erhalten werden dürfen. uv erstellt die Installation im frischen Job aus dem wiederhergestellten Python-Download-Cache.

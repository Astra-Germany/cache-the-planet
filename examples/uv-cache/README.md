# uv-Cache-Beispiel

Der uv-Cache wird mit `cache-local-path: .cache/uv` in den Workspace umgeleitet. `enable-cache` bleibt deaktiviert, damit `astral-sh/setup-uv` keinen nativen GitHub-Actions-Cache verwendet. `actions/setup-python` stellt die Python-Laufzeit bereit; sein optionales `cache: pip` bleibt ebenfalls deaktiviert. Der Workflow prüft diese Kombination in einem frischen Job.

Die separate Integration `uv-python-cache-integration.yml` testet zusätzlich uv-managed Python mit `UV_CACHE_DIR` und `UV_PYTHON_INSTALL_DIR`. Beide Verzeichnisse werden gemeinsam als Release-Asset gecacht und anschließend offline in einem frischen Job verwendet.

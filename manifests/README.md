# Reference manifest

`references-v1.json` is created on first save. It contains `schema_version: 1` and a map of logical keys to `{object, updated_at}`. Objects live only in the `cache-v1` prerelease.

The JSON manifest is the source of truth. Release assets contain the immutable
cache objects referenced by this file.

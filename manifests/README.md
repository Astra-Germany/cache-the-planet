# Reference manifest

`references-v1.json` is created on first save. It contains `schema_version: 1` and a map of logical keys to `{object, updated_at}`. Objects live only in the `cache-v1` prerelease.

After every successful save and pull-request cleanup, the description of the
`cache-v1` release is regenerated automatically. It contains a Markdown table
with the logical cache key, object hash, and update time.
The JSON manifest remains the source of truth; the release table is a readable
index for humans.

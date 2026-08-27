# Protocol v1

Object name: `<lowercase sha256 hex>.tar.zst`; identity is SHA-256 of the compressed bytes. Manifest:

```json
{"schema_version":1,"references":{"key":{"object":"sha256:<64 hex>","updated_at":"RFC3339"}}}
```

Clients must ignore unknown fields and preserve `schema_version`. A missing object, invalid digest, missing reference, or corrupt archive is a cache miss unless `strict: true`.

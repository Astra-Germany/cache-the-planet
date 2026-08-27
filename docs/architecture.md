# Architecture

One prerelease (`cache-v1`) stores immutable objects as release assets. The Contents API stores the small mutable reference index. This avoids repository clones and keeps large data outside Git history. Upload is create-only; references use optimistic concurrency.

The single manifest is practical for thousands of keys. A future schema can shard it without changing object names.

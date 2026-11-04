# Redis

Use Redis as **shared memory for workflows**: counters across runs, deduplication sets, state flags, queues, rankings,
and a real-time messaging channel to external systems. Self-hosted and managed instances, including Alibaba Cloud/Tencent Cloud Redis
and Upstash, work the same way; enter the address in the credential.

## 1. Prepare credentials

| Field | What to enter |
|---|---|
| Address | `host:port`, such as `redis.internal:6379`. **The plugin process must be able to reach it**. For managed instances, add the plugin machine's public IP to the allowlist. |
| Username | A Redis 6+ ACL user. Leave empty for traditional `requirepass` authentication. |
| Password | Leave empty if none is configured. |
| Database | Defaults to 0. **Cluster mode supports only database 0**. |
| TLS | `off` for plaintext internal connections; `on` for encrypted managed connections; `on_insecure` for self-signed certificates, encrypting without certificate verification. |

Click Check credentials after configuration. A successful connection shows the version, deployment mode, memory used, and key count in the current database.

## 2. Choose an operation

| Goal | Operation | Key output |
|---|---|---|
| Store/retrieve a value | Set / Get value | `exists`; a missing key is not an error. |
| Idempotency gate or simple lock | Set with Only if the key does not exist | Acquired only when `ok=true`. |
| Counting, rate limiting, or sequence numbers | Increment | `value`; atomic, with no lost concurrent updates. |
| Check whether an item was already seen | Add to set | `added=0` means already present. |
| Object-like state | Set / Get hash | `fields`. |
| Queue | Push / Pop list; right-push and left-pop give FIFO. | Empty queue returns zero items. |
| Rankings, priorities, or time windows | Add to sorted set + Read sorted-set range | Top 10: start 0, count 10, descending scores. |
| Find a set of keys | Scan keys; **do not use KEYS**. | Pass `cursor` back to continue; finished only when `done=true`. |
| Other commands | Generic command | Command name and arguments in official-documentation order. |

## 3. Trigger workflows from messages

Set Channels to watch or Streams to watch in the credential; **only then does the event source start**.
Select the corresponding event in a workflow **Event trigger**. The difference between the routes is **whether message loss is acceptable**:

| | Pub/Sub channels | Stream |
|---|---|---|
| Retention | Not retained; discarded after publishing. | Retained and replayable. |
| Messages while the plugin is disconnected | **Missed**. | Can be recovered by resuming from the ID. |
| Message ID | None. | Unique and increasing. |
| Best for | Real-time signals such as cache invalidation and reloads. | Tasks that must not be lost, such as orders, alerts, and to-dos. |

Channels support patterns such as `orders.*`. Streams start reading **from the moment of connection**, without replaying history;
connecting an old Stream with a backlog does not turn its entire history into workflow runs.

To send messages from the workflow, use Publish message for Pub/Sub or Add to Stream.

## 4. Common pitfalls

- **Missing data is not an error**. Get returns `exists=false` for a missing key; Pop returns zero items for an empty queue;
  a failed Only if absent condition returns `ok=false`. Use condition nodes to inspect these outputs instead of expecting an error branch.
- **Expiration must be positive**. Redis **immediately deletes the key** for zero or negative expiration. The plugin rejects this;
  use Delete keys when deletion is intended.
- **Bound writes where possible** using value expiration and the Stream retention-count limit. Unbounded keys keep growing;
  when memory fills, Redis rejects writes or evicts data you did not intend to delete.
- **Values are strings**. Numbers and booleans return as strings, as they do in Redis itself. Convert them when needed.
- **Do not use KEYS on a production database**. Redis is single-threaded; KEYS blocks the entire instance. Scan keys is incremental and safe.
- **Cluster mode** supports only database 0. Cross-slot commands, such as deleting several keys at once, may be rejected; split them into single-key operations.

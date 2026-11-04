# Elasticsearch

Connect ES to workflows to query logs and documents, ingest data, and manage indices. **ES 7 / 8 / 9 and OpenSearch are supported**:
the plugin uses standard REST APIs without pinning a client version.

## 1. Prepare credentials

| Field | What to enter |
|---|---|
| URL | Cluster URL with scheme and port, such as `https://es.internal:9200`. For multiple nodes, one node's address is sufficient. |
| Username / password | Basic authentication; the default ES 8 account is `elastic`. |
| API Key | The encoded value generated in Kibana → Stack Management → **API Keys**. When provided, username/password are not used. **Recommended** because access can be restricted by index and revoked independently. |
| Skip certificate verification | Select `on` for a self-hosted cluster with a self-signed certificate. The connection remains encrypted, but the peer's identity is not verified. |

Click Check credentials after configuration. A successful connection shows the distribution, version, cluster name, and cluster health:
`green` means healthy; `yellow` means replicas are unassigned, common on a single node; `red` means **a primary shard is missing and data is incomplete**.

## 2. Choose an operation

| Goal | Operation | Notes |
|---|---|---|
| Query documents | Search | **Query** accepts raw Query DSL; **Query string** accepts a one-line Lucene expression such as `status:error AND host:a1`. |
| Get only a count | Count documents | The count is exact, unlike some search totals; see the pitfalls below. |
| Calculate distributions or trends | Search + Aggregations | Leave the document count empty to return aggregations without documents. |
| Access documents by ID | Get / Index / Update / Delete document | Update changes supplied fields; indexing replaces the whole document. |
| Ingest a batch | Bulk index | One request writes multiple documents, roughly an order of magnitude faster than individual requests. |
| Remove expired data | Delete by query | **A query is required**; omitting it would delete the whole index. |
| Manage indices | List / Create / Delete indices, Get / Add mappings | |
| Change field types | Create index → Reindex → Switch aliases | ES cannot change existing field types; this is the required path. |
| Other APIs | Generic call | `_tasks`, `_ilm`, `_snapshot`, `_sql`, and others. |

Use `field:direction` for sorting, such as `@timestamp:desc`. Multiple entries are allowed; earlier entries take precedence.
For indices with many fields, selecting Only these fields can save considerable bandwidth.

## 3. Idempotency: prevent duplicate data on reruns

Workflows may retry or be triggered repeatedly. **Use a business primary key as the document ID** so a rerun overwrites the same document:

- Index document → set Document ID.
- Bulk index → set ID field, such as `sku` or `order_id`.

Without an ID, ES generates a new one each time. Running the same batch twice creates two copies, which can be difficult to notice.

## 4. Common pitfalls

- **Hit totals are exact only up to 10000 by default**. Above that, ES returns a lower bound, and Total is a lower bound is `true`.
  Enable Track exact total for an accurate total, at extra cost, or use Count documents.
- **Writes are not immediately searchable**. ES normally refreshes visibility after about one second. A missing result immediately after a write is often due to this delay.
  Enable Immediate search visibility for an individual write when needed, but **not inside a bulk loop**: forcing a shard refresh each time is slow.
- **Existing field types cannot be changed**, an ES limitation. Create a new index with new mappings → Reindex →
  Switch aliases. Readers that consistently use the alias need no changes.
- **`text` fields cannot be aggregated or sorted directly**. Use the `.keyword` subfield, such as `host.keyword` for `host`.
  If unsure, inspect Get mappings first.
- **Bulk indexing can partially succeed**. Failed entries do not roll back the batch. Outputs include Successful count, Failed count, and Failure reasons.
  **Check Failed count in the workflow**, rather than only checking whether the operation returned an error.
- **Pagination reaches at most the first 10000 documents**, the hard limit for `from + size`. For a full export, use Reindex,
  or use Generic call with `search_after` / PIT.
- **Destructive operations have safeguards**. Delete by query requires a query; Delete index rejects `*` and `_all`. The plugin rejects these requests
  and explains which operation to use. This is deliberate: both ES endpoints otherwise support deleting everything.

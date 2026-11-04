# kbstore-pgvector

Knowledge base storage engine plugin (Postgres + pgvector), implementing **the same** storage contract as `kbstore-es`.

Its primary purpose is to **exercise the contract**; findings are recorded in the contract notes in the plugin source repository.
For capability differences, particularly weaker Chinese keyword search than ES, see the usage guide in `doc.go`.

## Run locally

```bash
docker run -d --name sokel-pgvector \
  -e POSTGRES_USER=sokel -e POSTGRES_PASSWORD=sokel -e POSTGRES_DB=kbstore \
  -p 5434:5432 pgvector/pgvector:pg16

# Live database tests; the entire suite is skipped if this variable is unset.
PGVECTOR_TEST_URL='postgres://sokel:sokel@localhost:5434/kbstore?sslmode=disable' go test ./...

# Connect to the platform as a plugin.
SOKEL_TOKEN=<connection-group token> SOKEL_ENDPOINT=http://localhost:8088 go run .
```

Two credential fields: `pg_url` (connection string) and `namespace` (table prefix, defaults to kb). One table per knowledge base.

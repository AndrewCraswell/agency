# Shared legislation contracts

C is the sole shared contract/schema home, not a catch-all backend or deployed runtime. Each app configures its own
environment, pools, credentials and telemetry. Never import an app from C.

| Contract | Canonical page |
| --- | --- |
| Legislative model and change records | [Data model](engineering/data-model.md) |
| Relationship queries, aggregates and validation | [Relationship analytics](engineering/relationship-analytics.md) |
| Identity, entity taxonomy and minimum bill | [Civic identity](engineering/identity.md) |
| Membership dates and tenure identity | [Membership history](engineering/committee-membership-history.md) |
| Model/input/tokenizer/storage agreement | [Embedding contracts](engineering/embeddings.md) |
| Amendment and legal search schema | [Search projections](engineering/search-projections.md) |
| Legal identities, editions, temporal semantics and rights | [Regulatory data](regulations/data-contract.md) |
| Lossless text, blocks and continuation | [Reader contract](regulations/reader-contract.md) |
| One local database and explicit migration release | [Development](operations/development.md) |
| Aggregate PgBouncer policy and retained measurements | [Connection pooling](operations/database-connection-pooling.md) |
| App-free unit/schema checks | [Testing](operations/testing.md) |

Commands: `pnpm --filter @repo/legislation-core test`, `pnpm --filter @repo/legislation-core check:types`,
`pnpm --filter @repo/legislation-core db:up`. W releases C migrations explicitly, not at startup.

Consumers: [W product/API](../../../apps/legislation-web/docs/README.md),
[I source/worker evidence](../../../apps/legislation-ingestion/docs/README.md),
[M MCP transport](../../../apps/legislation-mcp/docs/README.md).
W lives at `apps/legislation-web`. [Root verification](../../../apps/legislation-web/docs/operations/testing.md#full-verification)
uses `pnpm verify:legislation`; the command's availability is not a passed check.
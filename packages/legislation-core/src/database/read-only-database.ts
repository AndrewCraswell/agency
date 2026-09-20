import { withReadOnlyDatabase, type LegislationDatabase } from "@repo/legislation-core/database/database"
import * as schema from "@repo/legislation-core/database/schema/schema"
import type { Query, SQL } from "drizzle-orm"
import { NodePgDatabase, NodePgSession, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres"
import {
  PgDialect,
  PgPreparedQuery,
  type PgTransaction,
  type PgTransactionConfig,
  type PreparedQueryConfig
} from "drizzle-orm/pg-core"
import type { SelectedFieldsOrdered } from "drizzle-orm/pg-core/query-builders/select.types"
import {
  createTableRelationsHelpers,
  extractTablesRelationalConfig,
  type ExtractTablesWithRelations
} from "drizzle-orm/relations"
import type pg from "pg"
type Tables = ExtractTablesWithRelations<typeof schema>
type Transaction = PgTransaction<NodePgQueryResultHKT, typeof schema, Tables>
type PreparedExecution<T extends PreparedQueryConfig> = (
  values: Record<string, unknown> | undefined,
  joins: Record<string, boolean> | undefined
) => Promise<T["execute"]>

class ReadOnlyPreparedQuery<T extends PreparedQueryConfig> extends PgPreparedQuery<T> {
  // Drizzle attaches this mapping after preparation to preserve nullable outer joins.
  declare joinsNotNullableMap?: Record<string, boolean>
  readonly #arrayMode: boolean
  readonly #run: PreparedExecution<T>

  constructor(query: Query, arrayMode: boolean, run: PreparedExecution<T>) {
    super(query, undefined, undefined)
    this.#arrayMode = arrayMode
    this.#run = run
  }

  override execute(values?: Record<string, unknown>): Promise<T["execute"]> {
    return this.#run(values, this.joinsNotNullableMap)
  }

  isResponseInArrayMode(): boolean {
    return this.#arrayMode
  }
}

/**
 * Acquires a read-only transaction for SQL, not for the surrounding service operation.
 * Embedding, reranking, and application work therefore do not occupy database connections.
 */
export function createReadOnlyDatabase(
  pool: pg.Pool,
  statementTimeoutMs: number,
  signal?: AbortSignal
): LegislationDatabase {
  const dialect = new PgDialect()
  const tables = extractTablesRelationalConfig<Tables>(schema, createTableRelationsHelpers)
  const relationalSchema = { fullSchema: schema, schema: tables.tables, tableNamesMap: tables.tableNamesMap }
  const run = <Result>(operation: (database: LegislationDatabase) => Promise<Result>) =>
    withReadOnlyDatabase(pool, statementTimeoutMs, operation, signal)

  class ReadOnlySession extends NodePgSession<typeof schema, Tables> {
    override prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
      query: Query,
      fields: SelectedFieldsOrdered | undefined,
      name: string | undefined,
      arrayMode: boolean,
      mapper?: (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => T["execute"]
    ): PgPreparedQuery<T> {
      return new ReadOnlyPreparedQuery<T>(query, arrayMode, (values, joins) =>
        run(async (database) => {
          const prepared = database._.session.prepareQuery<T>(query, fields, name, arrayMode, mapper)
          if (joins !== undefined) Object.assign(prepared, { joinsNotNullableMap: joins })
          return await prepared.execute(values)
        })
      )
    }

    override all<T = unknown>(query: SQL): Promise<T[]> {
      return run((database) => database._.session.all<T>(query))
    }

    override transaction<Result>(
      operation: (transaction: Transaction) => Promise<Result>,
      config?: PgTransactionConfig
    ): Promise<Result> {
      return withReadOnlyDatabase(pool, statementTimeoutMs, operation, signal, config)
    }
  }

  return new NodePgDatabase(dialect, new ReadOnlySession(pool, dialect, relationalSchema), relationalSchema)
}

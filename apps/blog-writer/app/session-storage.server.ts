import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql"
import { z } from "zod"

const databaseUrlSchema = z
  .string({ error: "DATABASE_URL is required" })
  .pipe(z.url({ error: "DATABASE_URL must be a valid URL" }))
  .refine((value) => value.startsWith("postgres://") || value.startsWith("postgresql://"), {
    message: "DATABASE_URL must use the postgres or postgresql protocol"
  })

export const parseDatabaseUrl = (value: string | undefined) => databaseUrlSchema.parse(value)

export const createSessionStorage = (databaseUrl: string | undefined) =>
  new PostgreSQLSessionStorage(parseDatabaseUrl(databaseUrl), {
    sessionTableName: "blog_writer_shopify_sessions",
    migratorOptions: {
      migrationDBIdentifier: "blog_writer_shopify_sessions_migrations",
      migrationNameColumnName: "migration_name"
    }
  })

type ShopSessionStorage = {
  deleteSessions: (sessionIds: string[]) => Promise<boolean>
  findSessionsByShop: (shop: string) => Promise<{ id: string }[]>
}

export const deleteShopSessions = async (sessionStorage: ShopSessionStorage, shop: string) => {
  const sessions = await sessionStorage.findSessionsByShop(shop)
  const sessionIds = sessions.map(({ id }) => id)
  if (sessionIds.length > 0) {
    await sessionStorage.deleteSessions(sessionIds)
  }
}

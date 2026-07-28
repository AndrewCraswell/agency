import { Session } from "@shopify/shopify-api"
import { afterAll, describe, expect, it } from "vitest"
import { createSessionStorage, deleteShopSessions } from "./session-storage.server"

const databaseUrl = process.env.BLOG_WRITER_TEST_DATABASE_URL
const describePostgres = databaseUrl === undefined ? describe.skip : describe

describePostgres("PostgreSQL session storage", () => {
  const storageInstances = new Set<ReturnType<typeof createSessionStorage>>()

  const createStorage = () => {
    const storage = createSessionStorage(databaseUrl)
    storageInstances.add(storage)
    return storage
  }

  afterAll(async () => {
    await Promise.all([...storageInstances].map(async (storage) => storage.disconnect()))
  })

  it("survives adapter recreation and deletes only the uninstalled shop", async () => {
    const shop = "installed-shop.myshopify.com"
    const otherShop = "other-shop.myshopify.com"
    const session = new Session({ id: `offline_${shop}`, shop, state: "", isOnline: false })
    session.accessToken = "installed-shop-token"
    const otherSession = new Session({ id: `offline_${otherShop}`, shop: otherShop, state: "", isOnline: false })
    otherSession.accessToken = "other-shop-token"

    const writer = createStorage()
    await writer.storeSession(session)
    await writer.storeSession(otherSession)

    const restartedReader = createStorage()
    await expect(restartedReader.loadSession(session.id)).resolves.toMatchObject({
      id: session.id,
      shop,
      accessToken: "installed-shop-token"
    })

    await deleteShopSessions(restartedReader, shop)

    await expect(restartedReader.loadSession(session.id)).resolves.toBeUndefined()
    await expect(restartedReader.loadSession(otherSession.id)).resolves.toMatchObject({ shop: otherShop })
    await deleteShopSessions(restartedReader, otherShop)
  })
})

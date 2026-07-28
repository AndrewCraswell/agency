import { describe, expect, it, vi } from "vitest"
import { deleteShopSessions, parseDatabaseUrl } from "./session-storage.server"

describe("parseDatabaseUrl", () => {
  it.each(["postgres://user:password@localhost/blog_writer", "postgresql://localhost/blog_writer"])(
    "accepts a PostgreSQL connection URL",
    (databaseUrl) => {
      expect(parseDatabaseUrl(databaseUrl)).toBe(databaseUrl)
    }
  )

  it.each([undefined, "", "https://localhost/blog_writer"])("rejects an invalid database URL", (databaseUrl) => {
    expect(() => parseDatabaseUrl(databaseUrl)).toThrow("DATABASE_URL")
  })
})

describe("deleteShopSessions", () => {
  it("deletes every session owned by the shop", async () => {
    const sessionStorage = {
      findSessionsByShop: vi
        .fn<(shop: string) => Promise<{ id: string }[]>>()
        .mockResolvedValue([{ id: "offline_shop" }, { id: "online_shop_user" }]),
      deleteSessions: vi.fn<(sessionIds: string[]) => Promise<boolean>>().mockResolvedValue(true)
    }

    await deleteShopSessions(sessionStorage, "shop.myshopify.com")

    expect(sessionStorage.findSessionsByShop).toHaveBeenCalledWith("shop.myshopify.com")
    expect(sessionStorage.deleteSessions).toHaveBeenCalledWith(["offline_shop", "online_shop_user"])
  })

  it("does not issue an empty delete", async () => {
    const sessionStorage = {
      findSessionsByShop: vi.fn<(shop: string) => Promise<{ id: string }[]>>().mockResolvedValue([]),
      deleteSessions: vi.fn<(sessionIds: string[]) => Promise<boolean>>()
    }

    await deleteShopSessions(sessionStorage, "shop.myshopify.com")

    expect(sessionStorage.deleteSessions).not.toHaveBeenCalled()
  })
})

import { MemorySaver } from "@langchain/langgraph"
import { beforeEach, describe, expect, it, vi } from "vitest"

const postgres = vi.hoisted(() => ({
  setup: vi.fn(),
  end: vi.fn(),
  construct: vi.fn(),
  fromConnString: vi.fn()
}))

vi.mock("@langchain/langgraph-checkpoint-postgres", () => ({
  PostgresSaver: class MockPostgresSaver {
    static fromConnString = postgres.fromConnString
    setup = postgres.setup
    end = postgres.end

    constructor(...parameters: unknown[]) {
      postgres.construct(...parameters)
    }
  }
}))

import { createCheckpointRuntime } from "./checkpointRuntime"

describe("createCheckpointRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    postgres.fromConnString.mockReturnValue({ setup: postgres.setup, end: postgres.end })
  })

  it("uses in-memory checkpoints when PostgreSQL is not configured", async () => {
    const runtime = await createCheckpointRuntime({})

    expect(runtime.provider).toBe("memory")
    expect(runtime.checkpointer).toBeInstanceOf(MemorySaver)
    await expect(runtime.close()).resolves.toBeUndefined()
  })

  it("sets up and closes a dedicated PostgreSQL checkpoint schema", async () => {
    const runtime = await createCheckpointRuntime({ POSTGRES_API_URL: "postgresql://user:secret@example.test/db" })

    expect(postgres.fromConnString).toHaveBeenCalledWith(
      expect.stringContaining("postgresql://user:secret@example.test/db"),
      {
        schema: "langgraph"
      }
    )
    expect(postgres.setup).toHaveBeenCalledOnce()
    expect(runtime.provider).toBe("postgres")
    await runtime.close()
    expect(postgres.end).toHaveBeenCalledOnce()
  })

  it("rejects a non-PostgreSQL database URL", async () => {
    await expect(createCheckpointRuntime({ POSTGRES_API_URL: "https://example.test/db" })).rejects.toThrow(
      "Expected a PostgreSQL connection URL"
    )
  })

  it("uses a renewable-token pool without taking Azure schema ownership", async () => {
    const runtime = await createCheckpointRuntime({
      POSTGRES_API_URL: "postgresql://worker@agency.postgres.database.azure.com/agentic",
      POSTGRES_PROVIDER: "azure"
    })

    expect(postgres.fromConnString).not.toHaveBeenCalled()
    expect(postgres.construct).toHaveBeenCalledOnce()
    expect(postgres.setup).not.toHaveBeenCalled()
    await runtime.close()
    expect(postgres.end).toHaveBeenCalledOnce()
  })
})

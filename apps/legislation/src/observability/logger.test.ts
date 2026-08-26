import { describe, expect, it } from "vitest"
import { createLogger, errorContext } from "./logger.js"

describe("createLogger", () => {
  it("writes structured records", () => {
    const lines: string[] = []
    const logger = createLogger({
      clock: () => new Date("2026-08-16T00:00:00.000Z"),
      level: "info",
      service: "legislation-test",
      write: (line) => lines.push(line)
    })

    logger.info("request completed", { correlationId: "request-1", statusCode: 200 })

    expect(lines).toEqual([
      '{"timestamp":"2026-08-16T00:00:00.000Z","level":"info","service":"legislation-test","message":"request completed","correlationId":"request-1","statusCode":200}'
    ])
  })

  it("filters records below the configured level", () => {
    const lines: string[] = []
    const logger = createLogger({ level: "warn", service: "legislation-test", write: (line) => lines.push(line) })

    logger.debug("debug")
    logger.info("info")
    logger.warn("warn")

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('"level":"warn"')
  })

  it("redacts credentials in keys, URLs, and bearer headers", () => {
    const lines: string[] = []
    const logger = createLogger({ level: "info", service: "test", write: (line) => lines.push(line) })

    logger.info("safe", {
      apiKey: "secret",
      authorization: "Bearer abc.def",
      database: "postgresql://user:password@example.test/policy"
    })

    expect(lines[0]).not.toContain("abc.def")
    expect(lines[0]).not.toContain("password@example")
    expect(lines[0]).not.toContain('"apiKey":"secret"')
  })
})

describe("errorContext", () => {
  it("serializes errors without their stack", () => {
    expect(errorContext(new TypeError("invalid source"))).toEqual({
      errorMessage: "invalid source",
      errorName: "TypeError"
    })
  })

  it("includes a sanitized immediate error cause", () => {
    const cause = new Error("connection failed for postgresql://user:password@example.test/legislation")
    const error = new Error("query failed", { cause })

    expect(errorContext(error)).toEqual({
      causeMessage: "connection failed for postgresql://user:[REDACTED]@example.test/legislation",
      causeName: "Error",
      errorMessage: "query failed",
      errorName: "Error"
    })
  })

  it("does not serialize unknown values", () => {
    expect(errorContext({ token: "secret" })).toEqual({ errorType: "object" })
  })
})

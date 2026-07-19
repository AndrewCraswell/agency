import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifyGitHubSignature } from "./signature"

describe("verifyGitHubSignature", () => {
  it("accepts the exact signed bytes and rejects altered or malformed signatures", () => {
    const body = Buffer.from('{"action":"completed"}', "utf8")
    const signature = `sha256=${createHmac("sha256", "webhook-secret").update(body).digest("hex")}`

    expect(verifyGitHubSignature(body, signature, "webhook-secret")).toBe(true)
    expect(verifyGitHubSignature(Buffer.from(`${body.toString("utf8")} `), signature, "webhook-secret")).toBe(false)
    expect(verifyGitHubSignature(body, "sha256=bad", "webhook-secret")).toBe(false)
    expect(verifyGitHubSignature(body, undefined, "webhook-secret")).toBe(false)
  })
})

import { beforeEach, describe, expect, it, vi } from "vitest"
import { createLazyAzureCredential } from "./azure-credential.js"

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  construct: vi.fn(),
  getToken: vi.fn(async (..._arguments: unknown[]) => ({ token: "fixture-token", expiresOnTimestamp: 12345 }))
}))
vi.mock("@azure/identity", () => {
  mocks.load()
  return {
    DefaultAzureCredential: class {
      constructor() {
        mocks.construct()
      }
      getToken = mocks.getToken
    }
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe("lazy Azure credential", () => {
  it("loads on token demand and shares one credential across concurrent requests", async () => {
    const credential = createLazyAzureCredential()
    const options = { abortSignal: new AbortController().signal }
    expect(mocks.load).not.toHaveBeenCalled()
    expect(mocks.construct).not.toHaveBeenCalled()

    await expect(
      Promise.all([
        credential.getToken("https://storage.azure.com/.default", options),
        credential.getToken(["https://cognitiveservices.azure.com/.default"])
      ])
    ).resolves.toEqual([
      { token: "fixture-token", expiresOnTimestamp: 12345 },
      { token: "fixture-token", expiresOnTimestamp: 12345 }
    ])
    expect(mocks.load).toHaveBeenCalledOnce()
    expect(mocks.construct).toHaveBeenCalledOnce()
    expect(mocks.getToken).toHaveBeenCalledWith("https://storage.azure.com/.default", options)
    expect(mocks.getToken).toHaveBeenCalledWith(["https://cognitiveservices.azure.com/.default"])
  })

  it("propagates token failures without caching a failed token request", async () => {
    const failure = new Error("Credential unavailable")
    mocks.getToken.mockRejectedValueOnce(failure)
    const credential = createLazyAzureCredential()
    await expect(credential.getToken("scope")).rejects.toBe(failure)
    await expect(credential.getToken("scope")).resolves.toMatchObject({ token: "fixture-token" })
    expect(mocks.construct).toHaveBeenCalledOnce()
    expect(mocks.getToken).toHaveBeenCalledTimes(2)
  })
})

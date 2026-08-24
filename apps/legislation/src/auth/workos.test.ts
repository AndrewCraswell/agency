import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose"
import { beforeAll, describe, expect, it } from "vitest"
import { AuthenticationError, createWorkosAuthenticator, extractBearerToken } from "./workos.js"

const issuer = "https://api.workos.com/user_management/client_test"
const apiAudience = "client_environment"
const mcpAudience = "https://legislation.example/mcp"
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"]
let apiAuthenticator: ReturnType<typeof createWorkosAuthenticator>
let mcpAuthenticator: ReturnType<typeof createWorkosAuthenticator>

beforeAll(async () => {
  const pair = await generateKeyPair("RS256")
  privateKey = pair.privateKey
  const publicJwk = await exportJWK(pair.publicKey)
  const getKey = createLocalJWKSet({ keys: [{ ...publicJwk, alg: "RS256", kid: "test" }] })
  apiAuthenticator = createWorkosAuthenticator(
    { audience: [apiAudience, mcpAudience], issuer, jwksUrl: "https://issuer.example/jwks" },
    getKey
  )
  mcpAuthenticator = createWorkosAuthenticator(
    { audience: mcpAudience, issuer, jwksUrl: "https://issuer.example/jwks" },
    getKey
  )
})

async function token(overrides: Readonly<Record<string, unknown>> = {}) {
  const tokenIssuer = typeof overrides.iss === "string" ? overrides.iss : issuer
  const tokenAudience = typeof overrides.aud === "string" ? overrides.aud : mcpAudience
  return new SignJWT({ org_id: "org_test" })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt()
    .setIssuer(tokenIssuer)
    .setAudience(tokenAudience)
    .setSubject("user_test")
    .setExpirationTime("5m")
    .sign(privateKey)
}

describe("WorkOS authentication", () => {
  it("extracts a strict bearer token", () => {
    expect(extractBearerToken("Bearer abc.def")).toBe("abc.def")
    expect(() => extractBearerToken(undefined)).toThrow(AuthenticationError)
    expect(() => extractBearerToken("Basic abc")).toThrow(AuthenticationError)
  })

  it("validates identity and optional organization", async () => {
    await expect(mcpAuthenticator(`Bearer ${await token()}`)).resolves.toEqual({
      organizationId: "org_test",
      userId: "user_test"
    })
  })

  it("allows API calls on behalf of an MCP caller without accepting M2M tokens on MCP", async () => {
    const apiToken = await token({ aud: apiAudience })
    const mcpToken = await token({ aud: mcpAudience })

    await expect(apiAuthenticator(`Bearer ${apiToken}`)).resolves.toMatchObject({ userId: "user_test" })
    await expect(mcpAuthenticator(`Bearer ${mcpToken}`)).resolves.toMatchObject({ userId: "user_test" })
    await expect(apiAuthenticator(`Bearer ${mcpToken}`)).resolves.toMatchObject({ userId: "user_test" })
    await expect(mcpAuthenticator(`Bearer ${apiToken}`)).rejects.toMatchObject({ category: "invalid" })
  })

  it.each([
    ["wrong audience", { aud: "wrong" }],
    ["wrong issuer", { iss: "https://wrong.example" }]
  ])("rejects %s", async (_label, claims) => {
    await expect(mcpAuthenticator(`Bearer ${await token(claims)}`)).rejects.toMatchObject({ category: "invalid" })
  })

  it("rejects expired tokens without leaking token details", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "test" })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(mcpAudience)
      .setSubject("user_test")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey)

    await expect(mcpAuthenticator(`Bearer ${expired}`)).rejects.toMatchObject({
      category: "expired",
      message: "Authentication failed"
    })
  })

  it("rejects malformed and tampered tokens", async () => {
    await expect(mcpAuthenticator("Bearer not-a-jwt")).rejects.toMatchObject({ category: "malformed" })
    const valid = await token()
    const [header, payload, signature] = valid.split(".")
    const tampered = `${header}.${payload}.${signature?.startsWith("a") === true ? "b" : "a"}${signature?.slice(1)}`
    await expect(mcpAuthenticator(`Bearer ${tampered}`)).rejects.toMatchObject({ category: "invalid" })
  })
})

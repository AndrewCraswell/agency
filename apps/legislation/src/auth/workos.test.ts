import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from "jose"
import { beforeAll, describe, expect, it } from "vitest"
import { AuthenticationError, createWorkosAuthenticator, extractBearerToken } from "./workos.js"

const issuer = "https://api.workos.com/user_management/client_test"
const apiAudience = "client_environment"
const mcpAudience = "https://legislation.example/mcp"
const sessionClientId = "client_01M05XW4MQ47YR95CNJWNQ9XDA"
const sessionIssuer = "https://api.workos.com"
const sessionLifetimeSeconds = 30 * 24 * 60 * 60
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"]
let apiAuthenticator: ReturnType<typeof createWorkosAuthenticator>
let mcpAuthenticator: ReturnType<typeof createWorkosAuthenticator>

beforeAll(async () => {
  const pair = await generateKeyPair("RS256")
  privateKey = pair.privateKey
  const publicJwk = await exportJWK(pair.publicKey)
  const getKey = createLocalJWKSet({ keys: [{ ...publicJwk, alg: "RS256", kid: "test" }] })
  apiAuthenticator = createWorkosAuthenticator(
    {
      m2m: { audience: [apiAudience, mcpAudience], issuer, jwksUrl: "https://issuer.example/jwks" },
      userSession: {
        clientId: sessionClientId,
        issuer: sessionIssuer,
        jwksUrl: `https://api.workos.com/sso/jwks/${sessionClientId}`
      }
    },
    { m2m: getKey, userSession: getKey }
  )
  mcpAuthenticator = createWorkosAuthenticator(
    { m2m: { audience: mcpAudience, issuer, jwksUrl: "https://issuer.example/jwks" } },
    { m2m: getKey }
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

async function sessionToken(overrides: Readonly<Record<string, unknown>> = {}) {
  const tokenIssuer = typeof overrides.iss === "string" ? overrides.iss : sessionIssuer
  const clientId = typeof overrides.client_id === "string" ? overrides.client_id : sessionClientId
  const sessionId = typeof overrides.sid === "string" ? overrides.sid : "session_test"
  const lifetimeSeconds =
    typeof overrides.lifetimeSeconds === "number" ? overrides.lifetimeSeconds : sessionLifetimeSeconds
  const issuedAt = Math.floor(Date.now() / 1000)
  const claims: Record<string, unknown> = { client_id: clientId, sid: sessionId }
  if (overrides.aud !== undefined) {
    claims.aud = overrides.aud
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setIssuedAt(issuedAt)
    .setIssuer(tokenIssuer)
    .setSubject("user_test")
    .setExpirationTime(issuedAt + lifetimeSeconds)
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

  it("accepts an AuthKit session whose expiry is exactly 30 days after issuance only for the API", async () => {
    const session = await sessionToken()

    await expect(apiAuthenticator(`Bearer ${session}`)).resolves.toEqual({ userId: "user_test" })
    await expect(mcpAuthenticator(`Bearer ${session}`)).rejects.toMatchObject({ category: "invalid" })
  })

  it.each([
    ["wrong client", { client_id: "client_wrong" }],
    ["wrong issuer", { iss: "https://issuer.example" }],
    ["audience claim", { aud: apiAudience }],
    ["missing session ID", { sid: "" }],
    ["lifetime one second over 30 days", { lifetimeSeconds: sessionLifetimeSeconds + 1 }],
    ["lifetime over 30 days", { lifetimeSeconds: 31 * 24 * 60 * 60 }]
  ])("rejects AuthKit sessions with %s", async (_label, claims) => {
    await expect(apiAuthenticator(`Bearer ${await sessionToken(claims)}`)).rejects.toMatchObject({
      category: "invalid"
    })
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

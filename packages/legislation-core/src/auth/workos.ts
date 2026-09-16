import { createRemoteJWKSet, decodeJwt, errors, jwtVerify, type JWTVerifyGetKey } from "jose"
import type { RequestIdentity } from "./request-context"

export type AuthenticationErrorCategory = "expired" | "invalid" | "malformed" | "missing" | "temporary"

export type WorkosIdentity = RequestIdentity &
  Readonly<{
    credentialType: "machine" | "user-session"
  }>

export class AuthenticationError extends Error {
  readonly category: AuthenticationErrorCategory

  constructor(category: AuthenticationErrorCategory) {
    super("Authentication failed")
    this.name = "AuthenticationError"
    this.category = category
  }
}

const MAXIMUM_AUTHKIT_SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60

export type WorkosAuthenticatorConfig = Readonly<{
  m2m: Readonly<{
    audience: string | string[]
    issuer: string
    jwksUrl: string
  }>
  userSession?: Readonly<{
    clientId: string
    issuer: string
    jwksUrl: string
  }>
}>

export type WorkosAuthenticatorKeys = Readonly<{
  m2m?: JWTVerifyGetKey
  userSession?: JWTVerifyGetKey
}>

export function extractBearerToken(authorizationHeader: string | string[] | undefined): string {
  if (authorizationHeader === undefined) {
    throw new AuthenticationError("missing")
  }
  if (Array.isArray(authorizationHeader)) {
    throw new AuthenticationError("malformed")
  }
  const match = /^Bearer ([^\s]+)$/i.exec(authorizationHeader)
  if (match?.[1] === undefined) {
    throw new AuthenticationError("malformed")
  }
  return match[1]
}

export function createWorkosAuthenticator(config: WorkosAuthenticatorConfig, keys: WorkosAuthenticatorKeys = {}) {
  const m2mGetKey =
    keys.m2m ??
    createRemoteJWKSet(new URL(config.m2m.jwksUrl), {
      cooldownDuration: 30_000,
      timeoutDuration: 5000
    })
  const sessionGetKey =
    config.userSession === undefined
      ? undefined
      : (keys.userSession ??
        createRemoteJWKSet(new URL(config.userSession.jwksUrl), {
          cooldownDuration: 30_000,
          timeoutDuration: 5000
        }))

  return async (authorizationHeader: string | string[] | undefined): Promise<WorkosIdentity> => {
    const token = extractBearerToken(authorizationHeader)
    try {
      const unverifiedPayload = decodeJwt(token)
      const isAuthKitSession =
        config.userSession !== undefined && unverifiedPayload.client_id === config.userSession.clientId
      const { payload } = isAuthKitSession
        ? await verifyAuthKitSessionToken(token, config.userSession, sessionGetKey)
        : await verifyM2mToken(token, config.m2m, m2mGetKey)
      return identityFromPayload(payload, isAuthKitSession ? "user-session" : "machine")
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error
      }
      if (error instanceof errors.JWTExpired) {
        throw new AuthenticationError("expired")
      }
      if (error instanceof errors.JWTInvalid || error instanceof errors.JWSInvalid) {
        throw new AuthenticationError("malformed")
      }
      if (error instanceof errors.JOSEError) {
        throw new AuthenticationError("invalid")
      }
      throw new AuthenticationError("temporary")
    }
  }
}

async function verifyM2mToken(token: string, config: WorkosAuthenticatorConfig["m2m"], getKey: JWTVerifyGetKey) {
  return await jwtVerify(token, getKey, {
    algorithms: ["RS256"],
    audience: config.audience,
    clockTolerance: 30,
    issuer: config.issuer,
    maxTokenAge: "24h",
    requiredClaims: ["exp", "iat", "sub"]
  })
}

async function verifyAuthKitSessionToken(
  token: string,
  config: NonNullable<WorkosAuthenticatorConfig["userSession"]>,
  getKey: JWTVerifyGetKey | undefined
) {
  if (getKey === undefined) {
    throw new AuthenticationError("invalid")
  }
  const result = await jwtVerify(token, getKey, {
    algorithms: ["RS256"],
    clockTolerance: 30,
    issuer: config.issuer,
    maxTokenAge: "30d",
    requiredClaims: ["client_id", "exp", "iat", "sid", "sub"]
  })
  if (
    result.payload.aud !== undefined ||
    result.payload.client_id !== config.clientId ||
    typeof result.payload.sid !== "string" ||
    result.payload.sid.length === 0 ||
    typeof result.payload.exp !== "number" ||
    typeof result.payload.iat !== "number" ||
    result.payload.exp - result.payload.iat > MAXIMUM_AUTHKIT_SESSION_LIFETIME_SECONDS
  ) {
    throw new AuthenticationError("invalid")
  }
  return result
}

function identityFromPayload(
  payload: Awaited<ReturnType<typeof jwtVerify>>["payload"],
  credentialType: WorkosIdentity["credentialType"]
): WorkosIdentity {
  let organizationId: string | undefined
  if (typeof payload.org_id === "string") {
    organizationId = payload.org_id
  } else if (typeof payload.organization_id === "string") {
    organizationId = payload.organization_id
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new AuthenticationError("invalid")
  }
  return { credentialType, organizationId, userId: payload.sub }
}

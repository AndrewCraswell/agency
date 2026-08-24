import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose"
import type { LegislationConfig } from "../config/config.js"
import type { RequestIdentity } from "./request-context.js"

export type AuthenticationErrorCategory = "expired" | "invalid" | "malformed" | "missing" | "temporary"

export class AuthenticationError extends Error {
  readonly category: AuthenticationErrorCategory

  constructor(category: AuthenticationErrorCategory) {
    super("Authentication failed")
    this.name = "AuthenticationError"
    this.category = category
  }
}

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

export function createWorkosAuthenticator(
  config: Readonly<{
    audience: string | string[]
    issuer: Extract<LegislationConfig["auth"], { mode: "workos" }>["issuer"]
    jwksUrl: Extract<LegislationConfig["auth"], { mode: "workos" }>["jwksUrl"]
  }>,
  getKey: JWTVerifyGetKey = createRemoteJWKSet(new URL(config.jwksUrl), {
    cooldownDuration: 30_000,
    timeoutDuration: 5000
  })
) {
  return async (authorizationHeader: string | string[] | undefined): Promise<RequestIdentity> => {
    const token = extractBearerToken(authorizationHeader)
    try {
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ["RS256"],
        audience: config.audience,
        clockTolerance: 30,
        issuer: config.issuer,
        maxTokenAge: "24h",
        requiredClaims: ["exp", "iat", "sub"]
      })
      let organizationId: string | undefined
      if (typeof payload.org_id === "string") {
        organizationId = payload.org_id
      } else if (typeof payload.organization_id === "string") {
        organizationId = payload.organization_id
      }
      if (typeof payload.sub !== "string" || payload.sub.length === 0) {
        throw new AuthenticationError("invalid")
      }
      return { organizationId, userId: payload.sub }
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

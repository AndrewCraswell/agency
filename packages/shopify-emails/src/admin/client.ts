import type { z } from "zod"

/** Pinned so a schema change shows up as a validation failure here, not as silently missing fields. */
export const ADMIN_API_VERSION = "2026-04"

export type AdminRequest<T> = {
  query: string
  variables?: Record<string, unknown>
  schema: z.ZodType<T>
}

export type AdminClient = <T>(request: AdminRequest<T>) => Promise<T>

export type StoreCredentials = {
  store: string
  token: string
}

/*
 * The direct route, for CI and for stores the Shopify CLI cannot reach.
 *
 * GraphQL errors arrive with HTTP 200, so a response is only usable once `errors` has been ruled
 * out. Messages are passed through but the token never is: a failure here is the most likely thing
 * to end up pasted into an issue.
 */
export const createTokenClient = ({ store, token }: StoreCredentials): AdminClient => {
  const endpoint = `https://${store}/admin/api/${ADMIN_API_VERSION}/graphql.json`

  return async ({ query, variables, schema }) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables })
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error(`${store} rejected the token. Check the app's scopes, then log in again.`)
    }
    if (!response.ok) {
      throw new Error(`${store} returned ${response.status} ${response.statusText}`)
    }

    const body: unknown = await response.json()
    const errors = extractErrors(body)
    if (errors) {
      throw new Error(`${store} rejected the query: ${errors}`)
    }
    return schema.parse(hasData(body) ? body.data : undefined)
  }
}

export const hasData = (body: unknown): body is { data: unknown } =>
  typeof body === "object" && body !== null && "data" in body

export const extractErrors = (body: unknown): string | undefined => {
  if (typeof body !== "object" || body === null || !("errors" in body)) {
    return undefined
  }
  const { errors } = body
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined
  }
  return errors
    .map((error: unknown) =>
      typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error)
    )
    .join("; ")
}

import { Nango } from "@nangohq/node"

type NangoWebhookType = "auth" | "sync" | "forward" | "async_action"

type NangoWebhookEnvelope = {
  type: NangoWebhookType
  from?: string
  providerConfigKey?: string
  connectionId?: string
  payload?: unknown
}

type ProviderPayloadSummary = {
  action: string
  type?: string
  id?: string | number
  objectId?: string | number
  resourceId?: string | number
}

export type NangoWebhookReceipt = {
  webhookType: "auth" | "sync" | "forward" | "async_action" | "unattributed" | "unknown"
  from?: string
  providerConfigKey?: string
  connectionId?: string
  providerEventAction?: string
  providerObjectType?: string
  providerObjectId?: string
  providerResourceId?: string
}

export type NangoWebhookReceiver = {
  verifyIncomingWebhookRequest(body: string, headers: Record<string, unknown>): boolean
  onAcceptedWebhook(receipt: NangoWebhookReceipt): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isNangoWebhookType(value: unknown): value is NangoWebhookType {
  return value === "auth" || value === "sync" || value === "forward" || value === "async_action"
}

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value)
}

function isNangoWebhookEnvelope(value: unknown): value is NangoWebhookEnvelope {
  return (
    isRecord(value) &&
    isNangoWebhookType(value.type) &&
    isOptionalNonEmptyString(value.from) &&
    isOptionalNonEmptyString(value.providerConfigKey) &&
    isOptionalNonEmptyString(value.connectionId)
  )
}

function isProviderPayloadSummary(value: unknown): value is ProviderPayloadSummary {
  return isRecord(value) && isNonEmptyString(value.action) && isOptionalNonEmptyString(value.type)
}

function addProviderSummary(receipt: NangoWebhookReceipt, payload: unknown): void {
  if (!isProviderPayloadSummary(payload)) {
    return
  }
  receipt.providerEventAction = payload.action
  if (payload.type !== undefined) {
    receipt.providerObjectType = payload.type
  }
  const objectId = payload.objectId ?? payload.id
  if (typeof objectId === "string" || typeof objectId === "number") receipt.providerObjectId = String(objectId)
  if (typeof payload.resourceId === "string" || typeof payload.resourceId === "number") {
    receipt.providerResourceId = String(payload.resourceId)
  }
}

export function summarizeNangoWebhook(body: string): NangoWebhookReceipt {
  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return { webhookType: "unknown" }
  }

  if (isNangoWebhookEnvelope(payload)) {
    const receipt: NangoWebhookReceipt = { webhookType: payload.type }
    if (payload.from !== undefined) {
      receipt.from = payload.from
    }
    if (payload.providerConfigKey !== undefined) {
      receipt.providerConfigKey = payload.providerConfigKey
    }
    if (payload.connectionId !== undefined) {
      receipt.connectionId = payload.connectionId
    }
    addProviderSummary(receipt, payload.payload)
    return receipt
  }

  if (!isProviderPayloadSummary(payload)) {
    return { webhookType: "unknown" }
  }
  const receipt: NangoWebhookReceipt = { webhookType: "unattributed" }
  addProviderSummary(receipt, payload)
  return receipt
}

export function createNangoWebhookReceiver(input: { apiKey: string; webhookSigningKey: string }): NangoWebhookReceiver {
  const nango = new Nango(input)
  return {
    verifyIncomingWebhookRequest: (body, headers) => nango.verifyIncomingWebhookRequest(body, headers),
    onAcceptedWebhook: (receipt) => {
      process.stdout.write(`[nango-webhook] accepted ${JSON.stringify(receipt)}\n`)
    }
  }
}

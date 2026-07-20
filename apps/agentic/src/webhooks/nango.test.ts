import { describe, expect, it } from "vitest"
import { summarizeNangoWebhook } from "./nango"

describe("Nango webhook receipts", () => {
  it("summarizes an attributed forwarded webhook without provider payload contents", () => {
    const receipt = summarizeNangoWebhook(
      JSON.stringify({
        type: "forward",
        from: "linear",
        providerConfigKey: "linear",
        connectionId: "linear-connection",
        payload: {
          action: "create",
          type: "Issue",
          data: {
            title: "Secret work item title",
            description: "Sensitive work item description"
          }
        }
      })
    )

    expect(receipt).toEqual({
      webhookType: "forward",
      from: "linear",
      providerConfigKey: "linear",
      connectionId: "linear-connection",
      providerEventAction: "create",
      providerObjectType: "Issue"
    })
    expect(JSON.stringify(receipt)).not.toContain("Secret work item title")
    expect(JSON.stringify(receipt)).not.toContain("Sensitive work item description")
  })

  it("summarizes an unattributed provider payload", () => {
    expect(summarizeNangoWebhook(JSON.stringify({ action: "update", type: "Issue", data: {} }))).toEqual({
      webhookType: "unattributed",
      providerEventAction: "update",
      providerObjectType: "Issue"
    })
  })

  it("classifies malformed and unsupported payloads as unknown", () => {
    expect(summarizeNangoWebhook("{")).toEqual({ webhookType: "unknown" })
    expect(summarizeNangoWebhook(JSON.stringify({ type: "future_webhook_type" }))).toEqual({
      webhookType: "unknown"
    })
  })
})

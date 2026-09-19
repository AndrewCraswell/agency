import type { Breadcrumb, Envelope, ErrorEvent, Integration, Log, Metric, TransactionEvent } from "@sentry/core"
import { z } from "zod"
import {
  payloadRecord,
  projectSentryMetadata,
  readPayloadField,
  safeSpanName,
  sentryPayloadFields as p,
  type SentryPayloadPolicy
} from "./sentryPayloadFields"
import { projectSentryBreadcrumb, projectSentryEvent, projectSentrySpan } from "./sentrySignalProjection"
import {
  decodeSentryAttributes,
  encodeSentryAttributes,
  projectSentryLog,
  projectSentryMetric
} from "./sentryTelemetryProjection"
import { checkTelemetryWireSize } from "./telemetryContracts"
import { telemetryFields as f } from "./telemetryFields"

type Signal = "event" | "transaction" | "span" | "log" | "metric" | "breadcrumb" | "envelope"
type Diagnostic = Readonly<{ signal: Signal; reason: "invalid_payload" | "unsupported_item"; count: number }>
type PrivacyOptions = SentryPayloadPolicy & Readonly<{ onDiagnostic?: (diagnostic: Diagnostic) => void }>

const identity = z.object({ trace_id: p.eventId, span_id: p.spanId.optional(), timestamp: p.timestamp })
const inference = { infer_ip: "never", infer_user_agent: "never" } as const

export function createSentryPrivacy(options: PrivacyOptions = {}) {
  const diagnostics = new Map<string, number>()
  let isReporting = false
  function report(signal: Signal, reason: Diagnostic["reason"]) {
    const key = `${signal}:${reason}`
    const count = Math.min((diagnostics.get(key) ?? 0) + 1, Number.MAX_SAFE_INTEGER)
    diagnostics.set(key, count)
    if (isReporting || count > 10) {
      return
    }
    isReporting = true
    try {
      if (options.onDiagnostic) {
        options.onDiagnostic({ signal, reason, count })
      } else {
        console.warn("Sentry privacy filter dropped payload", { signal, reason, count })
      }
    } catch {
      console.warn("Sentry privacy diagnostic failed", { signal, reason })
    } finally {
      isReporting = false
    }
  }
  function guard<T>(signal: Signal, project: () => T | null): T | null {
    try {
      const result = project()
      if (result === null) {
        report(signal, "invalid_payload")
      }
      return result
    } catch {
      report(signal, "invalid_payload")
      return null
    }
  }

  function beforeSend(input: ErrorEvent): ErrorEvent | null {
    return guard("event", () => {
      const event = projectSentryEvent(input, options)
      return event.type === undefined ? event : null
    })
  }
  function beforeSendTransaction(input: TransactionEvent): TransactionEvent | null {
    return guard("transaction", () => {
      const event = projectSentryEvent(input, options)
      return event.type === "transaction" ? event : null
    })
  }
  function beforeSendLog(input: Log) {
    return guard("log", () => projectSentryLog(input, options))
  }
  function beforeSendMetric(input: Metric) {
    return guard("metric", () => projectSentryMetric(input, options))
  }
  function beforeBreadcrumb(input: Breadcrumb) {
    return guard("breadcrumb", () => projectSentryBreadcrumb(input, options))
  }

  function projectEnvelope(envelope: Envelope, policy: SentryPayloadPolicy, trustedDsn?: string) {
    const items: Array<[Record<string, unknown>, unknown]> = []
    for (const [header, payload] of envelope[1]) {
      const raw = payloadRecord(payload)
      if (header.type === "event" || header.type === "transaction") {
        const event = guard(header.type, () => {
          const parsed = z.object({ type: z.literal("transaction").optional() }).safeParse(raw)
          if (!parsed.success || (header.type === "transaction") !== (parsed.data.type === "transaction")) {
            return null
          }
          return projectSentryEvent(payload, policy)
        })
        if (event) {
          items.push([{ type: header.type }, event])
        }
      } else if (header.type === "log" || header.type === "trace_metric") {
        const signal = header.type === "log" ? "log" : "metric"
        const candidates = readPayloadField(z.array(z.unknown()).max(1000), raw.items)
        if (!candidates) {
          report(signal, "invalid_payload")
          continue
        }
        const records = candidates.flatMap((candidate) => {
          const projected = guard(signal, () => {
            const entry = payloadRecord(candidate)
            const base = identity.parse(entry)
            const attributes = decodeSentryAttributes(entry.attributes)
            if (signal === "log") {
              const log = z.object({ body: z.string() }).parse(entry)
              const result = projectSentryLog({ level: "info", message: log.body, attributes }, policy)
              const record = {
                ...base,
                level: result.level,
                body: result.message,
                attributes: encodeSentryAttributes(result.attributes)
              }
              checkTelemetryWireSize("event", record)
              return record
            }
            const metric = z
              .object({
                name: z.string(),
                value: z.number(),
                type: z.enum(["counter", "gauge", "distribution"]),
                unit: z.string().optional()
              })
              .parse(entry)
            const result = projectSentryMetric({ ...metric, attributes }, policy)
            const record = { ...base, ...result, attributes: encodeSentryAttributes(result.attributes) }
            checkTelemetryWireSize("metric", record)
            return record
          })
          return projected ? [projected] : []
        })
        if (records.length) {
          items.push([
            {
              type: header.type,
              item_count: records.length,
              content_type:
                signal === "log"
                  ? "application/vnd.sentry.items.log+json"
                  : "application/vnd.sentry.items.trace-metric+json"
            },
            { items: records, ingest_settings: inference }
          ])
        }
      } else if (header.type === "span") {
        if (header.content_type === "application/vnd.sentry.items.span.v2+json") {
          const candidates = readPayloadField(z.array(z.unknown()).max(200), raw.items)
          if (!candidates) {
            report("span", "invalid_payload")
            continue
          }
          const spans = candidates.flatMap((candidate) => {
            const projected = guard("span", () => {
              const entry = payloadRecord(candidate)
              const span = z
                .object({
                  trace_id: p.eventId,
                  span_id: p.spanId,
                  parent_span_id: p.spanId.optional(),
                  start_timestamp: p.timestamp,
                  end_timestamp: p.timestamp,
                  status: z.enum(["ok", "error"]),
                  is_segment: z.boolean()
                })
                .parse(entry)
              if (span.end_timestamp < span.start_timestamp) {
                return null
              }
              const decoded = decodeSentryAttributes(entry.attributes)
              const op = readPayloadField(p.spanOperation, decoded["sentry.op"]) ?? "app.operation"
              return {
                ...span,
                name: safeSpanName(entry.name, op),
                attributes: encodeSentryAttributes(projectSentryMetadata(decoded, policy))
              }
            })
            return projected ? [projected] : []
          })
          if (spans.length) {
            items.push([
              {
                type: "span",
                item_count: spans.length,
                content_type: "application/vnd.sentry.items.span.v2+json"
              },
              { items: spans, ingest_settings: inference }
            ])
          }
        } else {
          const span = guard("span", () => projectSentrySpan(raw, policy))
          if (span) {
            items.push([{ type: "span" }, span])
          }
        }
      } else if (header.type === "client_report") {
        const reportPayload = guard("envelope", () =>
          z
            .object({
              timestamp: p.timestamp,
              discarded_events: z
                .array(
                  z.object({
                    reason: z.enum([
                      "before_send",
                      "event_processor",
                      "network_error",
                      "queue_overflow",
                      "ratelimit_backoff",
                      "sample_rate",
                      "send_error",
                      "internal_sdk_error",
                      "buffer_overflow",
                      "ignored",
                      "invalid",
                      "no_parent_span"
                    ]),
                    category: z.enum([
                      "default",
                      "error",
                      "transaction",
                      "replay",
                      "security",
                      "attachment",
                      "session",
                      "internal",
                      "profile",
                      "monitor",
                      "feedback",
                      "span",
                      "log_item",
                      "log_byte",
                      "metric",
                      "unknown"
                    ]),
                    quantity: f.count
                  })
                )
                .max(100)
            })
            .parse(raw)
        )
        if (reportPayload) {
          items.push([{ type: "client_report" }, reportPayload])
        }
      } else {
        report("envelope", "unsupported_item")
      }
    }
    const header = envelope[0]
    const projectedHeader = {
      event_id: readPayloadField(p.eventId, header.event_id),
      sent_at: readPayloadField(z.iso.datetime(), header.sent_at),
      dsn: header.dsn === trustedDsn ? trustedDsn : undefined
    }
    const writableEnvelope: [Record<string, unknown>, Array<[Record<string, unknown>, unknown]>] = envelope
    writableEnvelope[0] = projectedHeader
    writableEnvelope[1] = items
  }

  const integration: Integration = {
    name: "RostraPrivacy",
    afterAllSetup(client) {
      client.on("beforeEnvelope", (envelope) => {
        try {
          projectEnvelope(
            envelope,
            { ...options, release: client.getOptions().release ?? options.release },
            client.getOptions().dsn
          )
        } catch {
          Object.keys(envelope[0]).forEach((key) => {
            delete envelope[0][key]
          })
          envelope[1].splice(0, envelope[1].length)
          report("envelope", "invalid_payload")
        }
      })
    }
  }
  return { beforeSend, beforeSendTransaction, beforeSendLog, beforeSendMetric, beforeBreadcrumb, integration }
}

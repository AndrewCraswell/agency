import type { BaseTransportOptions, Transport } from "@sentry/core"

const deliveryFailures = new Set([
  "network_error",
  "queue_overflow",
  "ratelimit_backoff",
  "send_error",
  "buffer_overflow"
])

export function diagnosticTransport<Options extends BaseTransportOptions>(create: (options: Options) => Transport) {
  return (options: Options): Transport => {
    let notifications = 0
    return create({
      ...options,
      recordDroppedEvent: (...args) => {
        options.recordDroppedEvent(...args)
        const [reason, category] = args
        if (deliveryFailures.has(reason) && notifications++ < 10) {
          console.warn("Telemetry delivery dropped an item", { reason, category })
        }
      }
    })
  }
}

import { z } from "zod"
import { downloadDocument } from "../ingestion/documents/download.js"
import { createDocumentRelayServer } from "../ingestion/documents/relay-server.js"

const config = z
  .object({
    host: z.string().trim().min(1),
    port: z.coerce.number().int().min(1).max(65535),
    token: z.string().trim().min(1),
    timeoutMs: z.coerce.number().int().min(1000).max(300000)
  })
  .parse({
    host: process.env.DOCUMENT_FETCH_RELAY_HOST ?? "127.0.0.1",
    port: process.env.PORT ?? process.env.DOCUMENT_FETCH_RELAY_PORT ?? "3102",
    token: process.env.DOCUMENT_FETCH_RELAY_TOKEN,
    timeoutMs: process.env.INGESTION_REQUEST_TIMEOUT_MS ?? "30000"
  })
const server = createDocumentRelayServer({
  token: config.token,
  fetch: (sourceUrl) => downloadDocument(sourceUrl, { detectContentType: false, fetch, timeoutMs: config.timeoutMs })
})
server.listen(config.port, config.host)
let isClosing = false
function shutdown() {
  if (isClosing) return
  isClosing = true
  const timer = setTimeout(() => server.closeAllConnections(), 30_000)
  timer.unref()
  server.close((error) => {
    clearTimeout(timer)
    if (error) process.exitCode = 1
  })
}
process.once("SIGTERM", shutdown)
process.once("SIGINT", shutdown)

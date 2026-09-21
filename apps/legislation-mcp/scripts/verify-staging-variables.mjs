const stagingWebOrigin = "https://legislation-web-staging.up.railway.app"

export function verifyStagingVariables(service, variables) {
  const string = (name) => (typeof variables[name] === "string" ? variables[name].trim() : "")
  if (service === "web") {
    if (string("NEXT_PUBLIC_SENTRY_ENVIRONMENT") !== "staging" || !string("NEXT_PUBLIC_SENTRY_DSN")) {
      throw new Error("Staging W requires its staging Sentry environment and DSN")
    }
    return
  }
  if (service === "mcp") {
    if (string("SENTRY_ENVIRONMENT") !== "staging" || !string("SENTRY_DSN")) {
      throw new Error("Staging M requires its staging Sentry environment and DSN")
    }
    if (string("MCP_API_BASE_URL") !== stagingWebOrigin) {
      throw new Error("Staging M must route exclusively to the canonical staging W origin")
    }
    return
  }
  throw new Error("Expected service argument web or mcp")
}

async function main() {
  const chunks = []
  let bytes = 0
  for await (const chunk of process.stdin) {
    bytes += chunk.length
    if (bytes > 1_000_000) throw new Error("Railway variable payload is unexpectedly large")
    chunks.push(chunk)
  }
  const variables = JSON.parse(Buffer.concat(chunks).toString("utf8"))
  verifyStagingVariables(process.argv[2], variables)
  process.stdout.write(`${JSON.stringify({ service: process.argv[2], status: "configured" })}\n`)
}

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await main()
}

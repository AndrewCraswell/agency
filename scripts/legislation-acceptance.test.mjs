import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { access } from "node:fs/promises"
import { createServer, request as httpRequest } from "node:http"
import { createRequire } from "node:module"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const mcpDirectory = join(root, "apps/legislation-mcp")
const webDirectory = join(root, "apps/legislation-web/.next/standalone/apps/legislation-web")
const issuer = "https://issuer.acceptance.test"
const apiOrigin = "https://web.acceptance.test"
const resource = "https://mcp.acceptance.test/mcp"
const audience = "acceptance-api-client"
const correlationId = "root-m-to-w-acceptance"
const role = process.env.LEGISLATION_ACCEPTANCE_CHILD

async function socketFetch(input, init) {
  const incoming = new Request(input, init)
  const url = new URL(incoming.url)
  assert.equal(url.protocol, "http:")
  assert.equal(url.hostname, "127.0.0.1")
  const body = Buffer.from(await incoming.arrayBuffer())
  return await new Promise((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: incoming.method,
        headers: Object.fromEntries(incoming.headers),
        signal: incoming.signal
      },
      (response) => {
        const chunks = []
        response.on("data", (chunk) => chunks.push(chunk))
        response.on("error", reject)
        response.on("end", () => {
          const headers = new Headers()
          for (const [name, value] of Object.entries(response.headers)) {
            for (const item of Array.isArray(value) ? value : [value]) {
              if (item !== undefined) headers.append(name, item)
            }
          }
          resolve(
            new Response(chunks.length === 0 ? null : Buffer.concat(chunks), {
              status: response.statusCode,
              headers
            })
          )
        })
      }
    )
    request.on("error", reject)
    request.end(body)
  })
}

async function fixtureFetch(input, init) {
  const request = new Request(input, init)
  const url = new URL(request.url)
  assert.equal(url.protocol, "https:", "Configured public origins must remain HTTPS")
  let target
  if (url.origin === issuer) {
    assert.ok(url.pathname === "/jwks" || (role === "mcp" && url.pathname === "/oauth2/token"))
    target = process.env.LEGISLATION_ACCEPTANCE_ISSUER_ORIGIN
  } else {
    assert.equal(role, "mcp", "W must not call external services")
    assert.equal(url.origin, apiOrigin, "M must call only the configured W API")
    target = process.env.LEGISLATION_ACCEPTANCE_WEB_ORIGIN
  }
  const response = await socketFetch(new URL(url.pathname + url.search, target), {
    method: request.method,
    headers: request.headers,
    body: request.body,
    duplex: "half",
    redirect: "error",
    signal: request.signal
  })
  if (url.origin === apiOrigin) {
    process.send({
      type: "api-response",
      path: url.pathname + url.search,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      status: response.status,
      responseHeaders: Object.fromEntries(response.headers),
      body: await response.clone().json()
    })
  }
  return response
}

async function bounded(promise, milliseconds, message) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), milliseconds)
        timer.unref()
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function listen(server) {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return `http://127.0.0.1:${address.port}`
}

async function close(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeAllConnections()
  })
}

function startChild(args, cwd, environment) {
  const system = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => /^(SystemRoot|WINDIR|TEMP|TMP)$/i.test(name))
  )
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...system, ...environment },
    stdio: ["ignore", "pipe", "pipe", "ipc"]
  })
  let output = ""
  const messages = []
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-65_536)
    })
  }
  child.on("message", (message) => messages.push(message))
  const exited = once(child, "exit")
  void exited.catch(() => undefined)
  return {
    child,
    messages,
    exited,
    output: () => output,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
      await bounded(exited, 10_000, "Acceptance child did not exit")
    }
  }
}

async function waitForHealth(running, origin) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    assert.equal(running.child.exitCode, null, running.output())
    assert.equal(running.child.signalCode, null, running.output())
    try {
      const response = await socketFetch(`${origin}/health`, { signal: AbortSignal.timeout(1000) })
      if (response.ok && (await response.json()).status === "ok") return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  assert.fail("Built Next server did not become healthy: " + running.output())
}

if (role === "web") {
  globalThis.fetch = fixtureFetch
} else if (role === "mcp") {
  globalThis.fetch = fixtureFetch
  const { webcrypto } = await import("node:crypto")
  const {
    createMcpApplication,
    createMcpServer,
    listen: listenMcp,
    close: closeMcp
  } = await import(pathToFileURL(join(mcpDirectory, "dist/application.mjs")).href)
  const publicKey = await webcrypto.subtle.importKey(
    "jwk",
    JSON.parse(process.env.LEGISLATION_ACCEPTANCE_PUBLIC_JWK),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  )
  const application = createMcpApplication(process.env, { keys: { m2m: async () => publicKey }, fetch: fixtureFetch })
  const server = createMcpServer(application)
  await listenMcp(server, 0, "127.0.0.1")
  process.on("message", async (message) => {
    if (message.type === "stop") {
      await closeMcp(server, application)
      process.disconnect()
    }
  })
  process.send({ type: "listening", origin: `http://127.0.0.1:${server.address().port}` })
} else {
  test("root-coordinated built M to real built W", { timeout: 90_000 }, async (context) => {
    await access(join(mcpDirectory, "dist/application.mjs"))
    await access(join(webDirectory, "server.js"))
    const requireMcp = createRequire(join(mcpDirectory, "package.json"))
    const { Client, StreamableHTTPClientTransport } = await import(
      pathToFileURL(requireMcp.resolve("@modelcontextprotocol/client")).href
    )
    const { exportJWK, generateKeyPair, SignJWT } = await import(pathToFileURL(requireMcp.resolve("jose")).href)
    const keys = await generateKeyPair("RS256")
    const publicJwk = { ...(await exportJWK(keys.publicKey)), kid: "root-acceptance", alg: "RS256", use: "sig" }
    const sign = (tokenAudience, subject) =>
      new SignJWT({ org_id: "org-acceptance" })
        .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
        .setIssuer(issuer)
        .setAudience(tokenAudience)
        .setSubject(subject)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(keys.privateKey)
    const incomingToken = await sign(resource, "mcp-reader")
    const apiToken = await sign(audience, "mcp-reader")
    const issuerRequests = []
    const fixtures = []
    const children = []
    let transport
    context.after(async () => {
      try {
        if (transport) await bounded(transport.close(), 5000, "MCP client did not close")
      } finally {
        try {
          await Promise.all(children.map((running) => running.stop()))
        } finally {
          await Promise.all(fixtures.map(close))
        }
      }
    })
    const identityServer = createServer(async (request, response) => {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      issuerRequests.push({
        method: request.method,
        path: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks).toString()
      })
      response.setHeader("content-type", "application/json")
      if (request.method === "GET" && request.url === "/jwks") {
        response.end(JSON.stringify({ keys: [publicJwk] }))
      } else if (request.method === "POST" && request.url === "/oauth2/token") {
        response.end(JSON.stringify({ access_token: apiToken, token_type: "Bearer", expires_in: 300 }))
      } else {
        response.writeHead(404).end(JSON.stringify({ error: "not_found" }))
      }
    })
    const identityOrigin = await listen(identityServer)
    fixtures.push(identityServer)
    const reservation = createServer()
    const webOrigin = await listen(reservation)
    await close(reservation)
    const unavailableDatabase = createServer()
    const databaseOrigin = await listen(unavailableDatabase)
    fixtures.push(unavailableDatabase)
    let databaseConnections = 0
    unavailableDatabase.on("connection", (socket) => {
      databaseConnections += 1
      socket.destroy()
    })
    const databaseUrl = process.env.LEGISLATION_ACCEPTANCE_DATABASE_URL
    const billId = process.env.LEGISLATION_ACCEPTANCE_BILL_ID
    assert.equal(
      Boolean(databaseUrl),
      Boolean(billId),
      "Supply both a disposable database URL and an existing fixture bill ID"
    )
    if (databaseUrl) {
      const database = new URL(databaseUrl)
      assert.match(database.protocol, /^postgres(?:ql)?:$/)
      assert.equal(database.hostname, "127.0.0.1", "Only an explicitly supplied loopback database is allowed")
      assert.match(
        database.pathname,
        /(?:test|acceptance)/i,
        "Use a disposable test database, never an application database"
      )
    }
    const environment = {
      NODE_ENV: "production",
      AUTH_MODE: "workos",
      WORKOS_ISSUER: issuer,
      WORKOS_JWKS_URL: `${issuer}/jwks`,
      WORKOS_API_AUDIENCE: audience,
      WORKOS_MCP_AUDIENCE: resource,
      WORKOS_CLIENT_ID: "acceptance-session-client",
      WORKOS_SESSION_ISSUER: `${issuer}/sessions`,
      WORKOS_SESSION_JWKS_URL: `${issuer}/jwks`,
      WORKOS_API_M2M_CLIENT_ID: audience,
      WORKOS_API_M2M_CLIENT_SECRET: "local-acceptance-not-a-secret",
      MCP_API_BASE_URL: apiOrigin,
      LEGISLATION_ACCEPTANCE_ISSUER_ORIGIN: identityOrigin,
      LEGISLATION_ACCEPTANCE_WEB_ORIGIN: webOrigin,
      LEGISLATION_ACCEPTANCE_PUBLIC_JWK: JSON.stringify(publicJwk)
    }
    const web = startChild(["--import", import.meta.url, "server.js"], webDirectory, {
      ...environment,
      LEGISLATION_ACCEPTANCE_CHILD: "web",
      DATABASE_URL: databaseUrl ?? `postgresql://fixture:fixture@127.0.0.1:${new URL(databaseOrigin).port}/acceptance`,
      DATABASE_CONNECTION_TIMEOUT_MS: "1000",
      LEGISLATION_PUBLIC_API_BASE_URL: apiOrigin,
      LEGISLATION_IDEMPOTENCY_ENCRYPTION_SECRET: Buffer.alloc(32, 1).toString("base64"),
      LEGISLATION_WEBHOOK_SECRET_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
      LEGISLATION_LEGAL_API_ORGANIZATIONS: "",
      NEXT_TELEMETRY_DISABLED: "1",
      HOSTNAME: "127.0.0.1",
      PORT: new URL(webOrigin).port,
      LOG_LEVEL: "error"
    })
    children.push(web)
    await waitForHealth(web, webOrigin)
    const mcp = startChild([fileURLToPath(import.meta.url)], root, {
      ...environment,
      LEGISLATION_ACCEPTANCE_CHILD: "mcp",
      LEGISLATION_LEGAL_API_ORGANIZATIONS: "org-acceptance"
    })
    children.push(mcp)
    const [listening] = await bounded(
      Promise.race([
        once(mcp.child, "message"),
        mcp.exited.then(() => {
          throw new Error(mcp.output())
        })
      ]),
      15_000,
      "Built MCP did not start"
    )
    assert.equal(listening.type, "listening")
    const mcpOrigin = listening.origin
    assert.equal(new Set([webOrigin, mcpOrigin, identityOrigin]).size, 3)
    assert.notEqual(new URL(resource).origin, apiOrigin)

    await context.test("both real runtimes enforce distinct JWT audiences", async () => {
      for (const token of [undefined, incomingToken]) {
        const response = await socketFetch(`${webOrigin}/api/bills/bill%3Aus%3A119%3Ahr%3A1`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          signal: AbortSignal.timeout(5000)
        })
        assert.equal(response.status, 401)
        assert.equal((await response.json()).error.category, "unauthorized")
      }
      for (const token of [undefined, apiToken]) {
        const response = await socketFetch(`${mcpOrigin}/mcp`, {
          method: "POST",
          headers: {
            host: new URL(resource).host,
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: "{}",
          signal: AbortSignal.timeout(5000)
        })
        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), { error: "unauthorized" })
      }
      assert.equal(databaseConnections, 0)
    })

    transport = new StreamableHTTPClientTransport(new URL(`${mcpOrigin}/mcp`), {
      fetch: socketFetch,
      requestInit: {
        headers: {
          host: new URL(resource).host,
          origin: new URL(resource).origin,
          authorization: `Bearer ${incomingToken}`,
          cookie: "caller-private-cookie=fixture",
          "x-api-key": "caller-private-key",
          "x-correlation-id": correlationId
        }
      }
    })
    const client = new Client(
      { name: "root-m-to-w-acceptance", version: "1.0.0" },
      { versionNegotiation: { mode: "auto" } }
    )
    await bounded(client.connect(transport), 10_000, "MCP initialization failed: " + mcp.output())
    const { tools } = await bounded(client.listTools(), 10_000, "MCP tool discovery did not complete")
    assert.ok(tools.some((tool) => tool.name === "get_bill"))
    assert.ok(tools.some((tool) => tool.name === "list_legal_codes"))
    assert.equal(mcp.messages.filter((message) => message.type === "api-response").length, 0)

    async function callWithWireEvidence(name, arguments_, expectedStatus, expectedCategory) {
      const evidence = once(mcp.child, "message")
      const result = await client.callTool({ name, arguments: arguments_ })
      const [wire] = await bounded(evidence, 5000, "M tool did not reach the real W runtime")
      assert.equal(wire.type, "api-response")
      assert.equal(wire.status, expectedStatus, JSON.stringify(wire.body))
      assert.equal(wire.headers.authorization, `Bearer ${apiToken}`)
      assert.equal(wire.headers["x-correlation-id"], correlationId)
      assert.equal(wire.responseHeaders["x-correlation-id"], correlationId)
      for (const header of ["cookie", "x-api-key", "origin"]) assert.equal(wire.headers[header], undefined)
      assert.ok(!JSON.stringify(wire).includes(incomingToken))
      assert.ok(!JSON.stringify(wire).includes(environment.WORKOS_API_M2M_CLIENT_SECRET))
      if (expectedCategory) {
        assert.equal(wire.body.error.category, expectedCategory)
        assert.equal(wire.body.error.correlationId, correlationId)
        assert.equal(result.isError, true)
        const errorContent = result.content.find((content) => content.type === "text")
        assert.ok(errorContent, "M must return a structured error in its text content")
        assert.deepEqual(JSON.parse(errorContent.text), {
          error: expectedCategory,
          message: wire.body.error.message,
          retryable: wire.body.error.retryable
        })
      } else {
        assert.notEqual(result.isError, true, JSON.stringify(result))
        assert.deepEqual(result.structuredContent, { data: wire.body.data })
      }
      return { result, wire }
    }

    await context.test(
      "W authenticates the API token and its legal denial maps back through M without a database",
      async () => {
        const { wire } = await callWithWireEvidence("list_legal_codes", {}, 403, "forbidden")
        assert.equal(wire.method, "GET")
        assert.equal(new URL(wire.path, apiOrigin).pathname, "/api/legal/codes")
        assert.equal(databaseConnections, 0)
      }
    )
    await context.test(
      "W database failure maps back through the M bill tool",
      { skip: Boolean(databaseUrl) },
      async () => {
        const { wire } = await callWithWireEvidence(
          "get_bill",
          { id: "bill:us:119:hr:1" },
          503,
          "dependency_unavailable"
        )
        assert.equal(wire.method, "GET")
        assert.equal(wire.path, "/api/bills/bill%3Aus%3A119%3Ahr%3A1")
        assert.ok(databaseConnections > 0)
      }
    )
    await context.test(
      "positive bill read from an explicitly supplied disposable corpus",
      {
        skip: databaseUrl ? false : "No disposable database/corpus supplied; positive data acceptance remains open"
      },
      async () => {
        const { wire } = await callWithWireEvidence("get_bill", { id: billId }, 200)
        assert.equal(wire.body.data.id, billId)
      }
    )
    const exchanges = issuerRequests.filter((request) => request.path === "/oauth2/token")
    assert.equal(exchanges.length, 1, "The real M token provider must exchange once and cache its API credential")
    assert.deepEqual(Object.fromEntries(new URLSearchParams(exchanges[0].body)), {
      grant_type: "client_credentials",
      client_id: audience,
      client_secret: environment.WORKOS_API_M2M_CLIENT_SECRET
    })
    assert.ok(
      issuerRequests.some((request) => request.path === "/jwks"),
      "Real W must load the local JWKS"
    )
    assert.ok(!JSON.stringify(issuerRequests).includes(incomingToken))
    await transport.close()
    mcp.child.send({ type: "stop" })
    assert.deepEqual(await bounded(mcp.exited, 10_000, "M did not shut down"), [0, null])
    context.diagnostic(
      "Real built M and Next W, separate loopback origins, local issuer only; HTTPS is fixture-mapped, not TLS acceptance."
    )
  })
}

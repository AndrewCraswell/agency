import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { createServer, request as httpRequest } from "node:http"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { test } from "node:test"
import { setTimeout as delay } from "node:timers/promises"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { exportJWK, generateKeyPair, SignJWT } from "jose"

const environment = {
  AUTH_MODE: "workos",
  WORKOS_ISSUER: "https://issuer.example.test",
  WORKOS_JWKS_URL: "https://issuer.example.test/jwks",
  WORKOS_API_AUDIENCE: "fixture-api-client",
  WORKOS_MCP_AUDIENCE: "https://mcp.example.test/mcp",
  MCP_API_BASE_URL: "https://api.example.test",
  WORKOS_API_M2M_CLIENT_ID: "fixture-api-client",
  WORKOS_API_M2M_CLIENT_SECRET: "fixture-client-secret"
}
const deploymentCommitSha = "a".repeat(40)
const bill = { id: "bill:us:119:hr:1", title: "Built acceptance fixture" }
const correlationId = "built-mcp-acceptance"

async function socketFetch(input, init) {
  const incoming = new Request(input, init)
  const body = Buffer.from(await incoming.arrayBuffer())
  return await new Promise((resolve, reject) => {
    const request = httpRequest(
      new URL(incoming.url),
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
            new Response(chunks.length > 0 ? Buffer.concat(chunks) : null, {
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

const isolation = `
  import assert from "node:assert/strict"
  import { isBuiltin, registerHooks } from "node:module"
  import { isAbsolute, relative } from "node:path"
  import { fileURLToPath } from "node:url"

  registerHooks({
    resolve(specifier, context, nextResolve) {
      assert.notEqual(specifier.replace(/^node:/, ""), "sqlite", "Database modules are forbidden")
      if (isBuiltin(specifier)) return nextResolve(specifier, context)
      const resolved = nextResolve(specifier, context)
      assert.ok(resolved.url.startsWith("file:"), "Only built files may be loaded")
      const path = relative(process.cwd(), fileURLToPath(resolved.url))
      assert.ok(!path.startsWith("..") && !isAbsolute(path), "Runtime dependency escaped dist: " + specifier)
      assert.ok(path.endsWith(".mjs"), "Runtime dependency is not bundled JavaScript: " + path)
      return resolved
    }
  })
  process.dlopen = () => { throw new Error("Native dependencies are forbidden") }
  const socketFetch = globalThis.fetch
  globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input)
    assert.equal(url.protocol, "http:", "Live services are forbidden")
    assert.equal(url.hostname, "127.0.0.1", "Only loopback fixtures are allowed")
    return socketFetch(input, init)
  }
`

const applicationHost = `
  import { webcrypto } from "node:crypto"
  import { createMcpApplication, createMcpServer, listen, close } from "./application.mjs"

  process.once("message", async ({ environment, publicJwk, issuerOrigin, apiOrigin }) => {
    try {
      const publicKey = await webcrypto.subtle.importKey(
        "jwk", publicJwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
      )
      const fixtureFetch = async (input, init) => {
        const request = new Request(input, init)
        const publicUrl = new URL(request.url)
        let fixtureOrigin
        if (publicUrl.origin === new URL(environment.WORKOS_ISSUER).origin) {
          fixtureOrigin = issuerOrigin
        } else if (publicUrl.origin === new URL(environment.MCP_API_BASE_URL).origin) {
          fixtureOrigin = apiOrigin
        } else {
          throw new Error("Unexpected outbound origin: " + publicUrl.origin)
        }
        if (publicUrl.protocol !== "https:") throw new Error("Public origins must remain HTTPS")
        return fetch(new URL(publicUrl.pathname + publicUrl.search, fixtureOrigin), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          duplex: "half",
          redirect: request.redirect,
          signal: request.signal
        })
      }
      const application = createMcpApplication(environment, {
        keys: { m2m: async () => publicKey }, fetch: fixtureFetch
      })
      const server = createMcpServer(application)
      await listen(server, 0, "127.0.0.1")
      const address = server.address()
      process.on("message", async (message) => {
        if (message.type === "stop") {
          await close(server, application)
          process.disconnect()
        }
      })
      process.send({ type: "listening", origin: "http://127.0.0.1:" + address.port })
    } catch (error) {
      process.stderr.write(String(error.stack) + "\\n")
      process.exit(1)
    }
  })
`

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

function startChild(directory, args, extraEnvironment = {}) {
  const systemEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => /^(SystemRoot|WINDIR|TEMP|TMP)$/i.test(name))
  )
  const child = spawn(
    process.execPath,
    ["--import", `data:text/javascript,${encodeURIComponent(isolation)}`, ...args],
    {
      cwd: directory,
      env: { ...systemEnvironment, ...extraEnvironment },
      stdio: ["ignore", "pipe", "pipe", "ipc"]
    }
  )
  let output = ""
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-65_536)
    })
  }
  const exited = once(child, "exit").then(([code, signal]) => ({ code, signal }))
  void exited.catch(() => undefined)
  return {
    child,
    exited,
    output: () => output,
    async stop() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM")
      await bounded(exited, 15_000, "Built MCP child did not exit")
    }
  }
}

async function listenFixture(server) {
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  assert.ok(address && typeof address !== "string")
  return `http://127.0.0.1:${address.port}`
}

async function closeFixture(server) {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
    server.closeAllConnections()
  })
}

async function waitForHealth(running, origin) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    assert.equal(running.child.exitCode, null, running.output())
    assert.equal(running.child.signalCode, null, running.output())
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) })
      await response.arrayBuffer()
      if (response.ok) return
    } catch {}
    await delay(25)
  }
  assert.fail(`Built MCP did not become healthy: ${running.output()}`)
}

async function assertPublicRoutes(origin) {
  for (const [path, expected] of [
    ["/health", { commitSha: deploymentCommitSha, status: "ok" }],
    ["/ready", { commitSha: deploymentCommitSha, status: "ready" }],
    [
      "/.well-known/oauth-protected-resource",
      {
        resource: environment.WORKOS_MCP_AUDIENCE,
        authorization_servers: [environment.WORKOS_ISSUER],
        bearer_methods_supported: ["header"]
      }
    ],
    [
      "/.well-known/oauth-protected-resource/mcp",
      {
        resource: environment.WORKOS_MCP_AUDIENCE,
        authorization_servers: [environment.WORKOS_ISSUER],
        bearer_methods_supported: ["header"]
      }
    ]
  ]) {
    const response = await fetch(`${origin}${path}`, {
      headers: { "x-correlation-id": correlationId, "x-forwarded-host": "attacker.example.test" },
      signal: AbortSignal.timeout(5000)
    })
    assert.equal(response.status, 200, path)
    assert.match(response.headers.get("content-type"), /application\/json/)
    assert.match(response.headers.get("cache-control"), /no-store/)
    assert.equal(response.headers.get("x-correlation-id"), correlationId)
    const body = await response.text()
    assert.ok(body.trim().length > 0, `${path} returned a blank body`)
    assert.deepEqual(JSON.parse(body), expected)
  }
}

async function assertRejected(origin, bearer) {
  const response = await socketFetch(`${origin}/mcp`, {
    method: "POST",
    headers: {
      host: "mcp.example.test",
      "content-type": "application/json",
      ...(bearer === undefined ? {} : { authorization: `Bearer ${bearer}` })
    },
    body: "{}",
    signal: AbortSignal.timeout(5000)
  })
  assert.equal(response.status, 401)
  assert.match(
    response.headers.get("www-authenticate"),
    /resource_metadata="https:\/\/mcp\.example\.test\/\.well-known\/oauth-protected-resource\/mcp"/
  )
  assert.deepEqual(await response.json(), { error: "unauthorized" })
}

test("isolated built MCP acceptance", { timeout: 60_000 }, async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "legislation-mcp-built-"))
  const children = []
  const fixtures = []
  context.after(async () => {
    try {
      await Promise.all(children.map((running) => running.stop()))
    } finally {
      await Promise.all(fixtures.map(closeFixture))
      await rm(directory, { recursive: true, force: true })
    }
  })
  await cp(new URL("../dist/", import.meta.url), directory, { recursive: true })

  await context.test("contains only bundled JavaScript and no database or native dependency sources", async () => {
    const files = await readdir(directory, { recursive: true, withFileTypes: true })
    const names = files
      .filter((entry) => entry.isFile())
      .map((entry) => relative(directory, join(entry.parentPath, entry.name)))
    assert.ok(names.includes("main.mjs"))
    assert.ok(names.includes("application.mjs"))
    assert.ok(
      names.some((name) => name.endsWith(".mjs.map")),
      "Source maps are required for the dependency audit"
    )
    for (const entry of files) {
      assert.ok(!entry.isSymbolicLink(), "The artifact must not contain symlinks")
      if (!entry.isFile()) continue
      assert.match(entry.name, /\.mjs(?:\.map)?$/, "Only JavaScript and source maps may ship")
      if (!entry.name.endsWith(".map")) continue
      const map = JSON.parse(await readFile(join(entry.parentPath, entry.name), "utf8"))
      assert.ok(Array.isArray(map.sources) && map.sources.length > 0)
      for (const source of map.sources) {
        const path = source.replaceAll("\\", "/")
        assert.doesNotMatch(
          path,
          /node_modules\/(?:@[^/]+\/)?(?:pg|pg-native|postgres|drizzle-orm|better-sqlite3|sqlite3|libsql|duckdb|sqlite-vec|sharp|onnxruntime-node|tiktoken|tokenizers|next)(?:\/|$)/
        )
        assert.doesNotMatch(path, /node_modules\/(?:@libsql|@duckdb|@huggingface|@neondatabase)\//)
        assert.doesNotMatch(path, /legislation-core\/src\/(?:db|database|storage|ingestion)\//)
      }
    }
  })

  await context.test("runs the actual main entry with nonblank probes, discovery and anonymous rejection", async () => {
    const reservation = createServer()
    const origin = await listenFixture(reservation)
    await closeFixture(reservation)
    const running = startChild(directory, ["main.mjs"], {
      ...environment,
      PORT: new URL(origin).port,
      RAILWAY_GIT_COMMIT_SHA: deploymentCommitSha
    })
    children.push(running)
    await waitForHealth(running, origin)
    await assertPublicRoutes(origin)
    await assertRejected(origin)
    await running.stop()
    assert.equal(running.output(), "")
  })

  await context.test(
    "authenticates locally and completes an SDK call to a distinct-origin API without forwarding credentials",
    async () => {
      const keys = await generateKeyPair("RS256")
      const publicJwk = await exportJWK(keys.publicKey)
      const sign = (audience, subject) =>
        new SignJWT({ org_id: "org-reader" })
          .setProtectedHeader({ alg: "RS256", kid: "fixture-key" })
          .setIssuer(environment.WORKOS_ISSUER)
          .setAudience(audience)
          .setSubject(subject)
          .setIssuedAt()
          .setExpirationTime("5m")
          .sign(keys.privateKey)
      const incomingToken = await sign(environment.WORKOS_MCP_AUDIENCE, "reader")
      const apiToken = await sign(environment.WORKOS_API_AUDIENCE, "api-service")
      const received = []
      const issuer = createServer(async (request, response) => {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        received.push({
          target: "issuer",
          method: request.method,
          path: request.url,
          headers: request.headers,
          body: Buffer.concat(chunks).toString("utf8")
        })
        response.setHeader("content-type", "application/json")
        if (request.method !== "POST" || request.url !== "/oauth2/token") {
          response.writeHead(404).end(JSON.stringify({ error: "not_found" }))
          return
        }
        response.end(JSON.stringify({ access_token: apiToken, token_type: "Bearer", expires_in: 3600 }))
      })
      const api = createServer(async (request, response) => {
        const chunks = []
        for await (const chunk of request) chunks.push(chunk)
        received.push({
          target: "api",
          method: request.method,
          path: request.url,
          headers: request.headers,
          body: Buffer.concat(chunks).toString("utf8")
        })
        response.setHeader("content-type", "application/json")
        response.setHeader("x-correlation-id", correlationId)
        if (
          request.method !== "GET" ||
          request.url !== `/api/bills/${encodeURIComponent(bill.id)}` ||
          request.headers.authorization !== `Bearer ${apiToken}`
        ) {
          response.writeHead(403).end(JSON.stringify({ error: "forbidden" }))
          return
        }
        response.end(
          JSON.stringify({ data: bill, links: { self: request.url }, meta: { correlationId, warnings: [] } })
        )
      })
      fixtures.push(issuer, api)
      const issuerOrigin = await listenFixture(issuer)
      const apiOrigin = await listenFixture(api)
      assert.notEqual(new URL(environment.WORKOS_MCP_AUDIENCE).origin, new URL(environment.MCP_API_BASE_URL).origin)
      assert.notEqual(issuerOrigin, apiOrigin)

      const running = startChild(directory, ["--input-type=module", "--eval", applicationHost], {
        RAILWAY_GIT_COMMIT_SHA: deploymentCommitSha
      })
      children.push(running)
      const listening = once(running.child, "message")
      running.child.send({ environment, publicJwk, issuerOrigin, apiOrigin })
      const [message] = await bounded(
        Promise.race([
          listening,
          running.exited.then(() => {
            throw new Error(`Built application exited before listening: ${running.output()}`)
          })
        ]),
        15_000,
        "Built application did not start"
      )
      assert.equal(message.type, "listening")
      const origin = message.origin
      assert.notEqual(origin, apiOrigin)
      assert.notEqual(origin, issuerOrigin)
      await assertPublicRoutes(origin)
      await assertRejected(origin)
      await assertRejected(origin, apiToken)
      assert.deepEqual(received, [], "Probes and rejected callers must not reach the issuer or API")

      const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`), {
        fetch: socketFetch,
        requestInit: {
          headers: {
            host: "mcp.example.test",
            origin: "https://mcp.example.test",
            authorization: `Bearer ${incomingToken}`,
            cookie: "caller-session=private-cookie",
            "x-api-key": "caller-private-key",
            "x-correlation-id": correlationId
          }
        }
      })
      const client = new Client(
        { name: "built-acceptance", version: "1.0.0" },
        { versionNegotiation: { mode: "auto" } }
      )
      try {
        await client.connect(transport)
        const { tools } = await client.listTools()
        assert.ok(tools.some((tool) => tool.name === "resolve_record"))
        assert.ok(tools.some((tool) => tool.name === "read_record_collection"))
        assert.ok(tools.some((tool) => tool.name === "get_bill"))
        assert.deepEqual(received, [], "Discovery must not acquire API credentials")
        const result = await client.callTool({ name: "get_bill", arguments: { id: bill.id } })
        assert.notEqual(result.isError, true, JSON.stringify(result))
        assert.deepEqual(result.structuredContent, { data: bill })
      } finally {
        await transport.close()
      }

      assert.equal(received.length, 2, "Exactly one token exchange and one API call are expected")
      const [exchange, query] = received
      assert.equal(exchange.target, "issuer")
      assert.equal(exchange.method, "POST")
      assert.equal(exchange.path, "/oauth2/token")
      assert.equal(exchange.headers.authorization, undefined)
      assert.deepEqual(Object.fromEntries(new URLSearchParams(exchange.body)), {
        client_id: environment.WORKOS_API_M2M_CLIENT_ID,
        client_secret: environment.WORKOS_API_M2M_CLIENT_SECRET,
        grant_type: "client_credentials"
      })
      assert.equal(query.target, "api")
      assert.equal(query.method, "GET")
      assert.equal(query.path, `/api/bills/${encodeURIComponent(bill.id)}`)
      assert.equal(query.headers.authorization, `Bearer ${apiToken}`)
      assert.equal(query.headers["x-correlation-id"], correlationId)
      assert.equal(query.body, "")
      for (const request of received) {
        assert.equal(request.headers.cookie, undefined)
        assert.equal(request.headers["x-api-key"], undefined)
        assert.equal(request.headers.origin, undefined)
        assert.notEqual(request.headers.host, "mcp.example.test")
      }
      assert.ok(!JSON.stringify(received).includes(incomingToken), "The MCP bearer must never leave the resource")
      assert.ok(
        !JSON.stringify(query).includes(environment.WORKOS_API_M2M_CLIENT_SECRET),
        "The client secret belongs only at the issuer"
      )
      assert.ok(
        !JSON.stringify(query).includes(environment.WORKOS_API_M2M_CLIENT_ID),
        "The API must receive only its access token"
      )
      running.child.send({ type: "stop" })
      assert.deepEqual(await bounded(running.exited, 15_000, "Built host did not shut down"), { code: 0, signal: null })
      assert.equal(running.output(), "")
    }
  )
})

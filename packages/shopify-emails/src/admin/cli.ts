import { readFile, writeFile } from "node:fs/promises"
import { relative } from "node:path"
import { parseArgs } from "node:util"
import {
  assetQuestions,
  buildProbe,
  marketingQuestions,
  notificationQuestions,
  type ProbeQuestions
} from "../probe/build.ts"
import { parseProbe, summariseProbe } from "../probe/capture.ts"
import { buildTemplates, GMAIL_CLIP_BYTES } from "./build.ts"
import { createAdminClient } from "./client.ts"
import { parseStoreDomain, saveToken } from "./credentials.ts"
import { shopResponse } from "./mapOrder.ts"
import { SHOP_QUERY } from "./queries.ts"
import { createStoreSource, type StoreSource } from "./store.ts"

/*
 * `login` and `build`: authenticate once, then compile the templates into the files that get pasted
 * into the admin. Reading live orders is the preview's job, not a command's — see `./store.ts`.
 *
 * Authentication is a custom app the merchant creates in their own admin, not OAuth. There is no
 * hosted app here to redirect to, and a merchant-created custom app already carries the customer
 * data access that a public app would have to apply for. The trade is that the token is long-lived,
 * which is why it never appears in an argument, a dotenv file, or this repository.
 */

const usage = `
shopify-emails login --store <shop>.myshopify.com
shopify-emails build [--dir <src>] [--out <dir>]
shopify-emails pull [--store <shop>] [--order <name|gid>] [--out <file>]
shopify-emails probe [--for notification|marketing|asset] [--names a,b] [--out <file>]
shopify-emails probe --capture <file.html> [--for notification|marketing|asset] [--out <file>]

Create the app under Settings > Apps > Develop apps, grant read_orders and read_customers,
install it, and reveal the Admin API access token. Only the last 60 days of orders are
readable unless Shopify has granted the store read_all_orders.

Notification templates have no API. \`probe\` prints a throwaway template to paste into one
in the admin; preview it, save the rendered HTML, and pass it back with --capture.

\`--for asset\` asks what the CDN filters resolve to instead of what the drops hold, and its
capture prints the resolved URLs as JSON rather than a present-or-absent report.

\`pull\` writes what a live order hands a template, so a preview can be read against real
values. Notification-only drops are not in it, because no API serves them: that is \`probe\`.
`.trim()

/** Never echoed, and never taken from an argument, so it cannot be recovered from shell history. */
const readToken = async (): Promise<string> => {
  if (process.env.SHOPIFY_ADMIN_TOKEN) {
    return process.env.SHOPIFY_ADMIN_TOKEN
  }
  if (!process.stdin.isTTY) {
    const piped: Buffer[] = []
    for await (const chunk of process.stdin) {
      piped.push(Buffer.from(chunk))
    }
    return Buffer.concat(piped).toString("utf8").trim()
  }

  process.stdout.write("Admin API access token: ")
  process.stdin.setRawMode(true)
  process.stdin.resume()

  let token = ""
  for await (const chunk of process.stdin) {
    const input = Buffer.from(chunk).toString("utf8")
    if (input === "\r" || input === "\n" || input === "\u0004") {
      break
    }
    if (input === "\u0003") {
      process.stdin.setRawMode(false)
      throw new Error("Cancelled. Run `login --store <shop>.myshopify.com` again when you have the token.")
    }
    token += input
  }
  process.stdin.setRawMode(false)
  process.stdin.pause()
  process.stdout.write("\n")
  return token.trim()
}

const login = async (store: string | undefined): Promise<void> => {
  if (!store) {
    throw new Error("login needs --store <shop>.myshopify.com")
  }
  const domain = parseStoreDomain(store)
  const token = await readToken()
  if (!token) {
    throw new Error(
      "No token was provided. Reveal the Admin API access token under API credentials in the custom app, then paste it at the prompt."
    )
  }

  // Proving the token works now beats a confusing failure the first time a preview loads an order.
  const client = createAdminClient({ store: domain, token })
  const { shop } = await client({ query: SHOP_QUERY, schema: shopResponse })

  await saveToken(domain, token)
  process.stdout.write(`Signed in to ${shop.name} (${domain})\n`)
}

const questions: Readonly<Record<string, ProbeQuestions>> = {
  asset: assetQuestions,
  marketing: marketingQuestions,
  notification: notificationQuestions
}

type ProbeOptions = {
  readonly for?: string
  readonly names?: string
  readonly capture?: string
  readonly out?: string
}

const list = (label: string, names: readonly string[]): string =>
  names.length === 0 ? "" : `\n${label} (${names.length})\n${names.map((name) => `  ${name}`).join("\n")}\n`

const probe = async ({ capture, names, out, for: surface = "notification" }: ProbeOptions): Promise<void> => {
  const chosen = questions[surface]
  if (!chosen) {
    throw new Error(`Unknown probe target "${surface}". Use notification, marketing, or asset.`)
  }
  const asked = names ? { ...chosen, names: names.split(",").map((name) => name.trim()) } : chosen

  if (capture) {
    const captured = parseProbe(await readFile(capture, "utf8"))

    /* An asset probe is asked for its values, so a present-or-absent report would throw them away. */
    if (surface === "asset") {
      const resolved = Object.fromEntries(
        Object.keys(asked.expressions).map((label) => [label, captured[label] ?? null])
      )
      const json = `${JSON.stringify(resolved, null, 2)}\n`
      if (out) {
        await writeFile(out, json, "utf8")
        process.stdout.write(`${relative(process.cwd(), out)}\n`)
        return
      }
      process.stdout.write(json)
      return
    }

    const report = summariseProbe(captured, asked)
    process.stdout.write(
      [
        list("Present", report.present),
        list("Empty for this order", report.empty),
        list("Absent", report.absent),
        list("Never answered, so the run was clipped", report.unanswered),
        list("Absent, yet a stock template reads it", report.absentButRead)
      ].join("")
    )
    return
  }

  const template = buildProbe(asked)
  if (out) {
    await writeFile(out, `${template}\n`, "utf8")
    process.stdout.write(`${relative(process.cwd(), out)}\n`)
    return
  }
  process.stdout.write(`${template}\n`)
}

type PullOptions = {
  readonly store?: string
  readonly order?: string
  readonly out?: string
}

/* An order is named `#1001` everywhere a person sees it, and by `gid://` everywhere the API does. */
const resolveOrderId = async (source: StoreSource, order?: string): Promise<string> => {
  if (order?.startsWith("gid://")) {
    return order
  }
  const found = await source.searchOrders(order ? { first: 1, query: `name:${order}` } : { first: 1 })
  const id = found[0]?.id
  if (!id) {
    const which = order ? `No order ${order} is readable` : "No orders are readable"
    throw new Error(`${which} on ${source.domain}. Only the last 60 days are, without read_all_orders.`)
  }
  return id
}

/*
 * What a live order hands a template, so a preview can be read against real values.
 *
 * Only what the Admin API serves. The drops that exist solely inside a notification render — the
 * branding the merchant set, and the CDN paths a filter computes — are `probe`'s to answer.
 */
const pull = async ({ order, out, store }: PullOptions): Promise<void> => {
  const source = await createStoreSource(store)
  const values = await source.loadOrderVariables(await resolveOrderId(source, order))
  const json = `${JSON.stringify(values, null, 2)}\n`
  if (out) {
    await writeFile(out, json, "utf8")
    process.stdout.write(`${relative(process.cwd(), out)}\n`)
    return
  }
  process.stdout.write(json)
}

export const run = async (argv: readonly string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      store: { type: "string" },
      dir: { type: "string", default: "src/emails" },
      out: { type: "string" },
      order: { type: "string" },
      for: { type: "string", default: "notification" },
      names: { type: "string" },
      capture: { type: "string" },
      help: { type: "boolean", default: false }
    }
  })

  const command = positionals[0]
  if (values.help || !command) {
    process.stdout.write(`${usage}\n`)
    return
  }
  if (command === "login") {
    await login(values.store)
    return
  }
  if (command === "probe") {
    await probe(values)
    return
  }
  if (command === "pull") {
    await pull(values)
    return
  }
  if (command === "build") {
    const built = await buildTemplates({ dir: values.dir, out: values.out ?? "dist" })
    for (const template of built) {
      process.stdout.write(`${relative(process.cwd(), template.body)}\n${relative(process.cwd(), template.subject)}\n`)
    }
    const noun = built.length === 1 ? "template" : "templates"
    process.stdout.write(
      `\n${built.length} ${noun}. Paste each .liquid into the matching notification body and its .subject.txt into the subject.\n`
    )
    for (const template of built.filter(({ bytes }) => bytes > GMAIL_CLIP_BYTES)) {
      const kb = Math.round(template.bytes / 1024)
      process.stdout.write(
        `\n${template.id} compiles to ${kb} KB, past the ${Math.round(GMAIL_CLIP_BYTES / 1024)} KB where Gmail clips a message. Every loop only grows that.\n`
      )
    }
    return
  }
  throw new Error(`Unknown command "${command}"\n\n${usage}`)
}

import { readFile, writeFile } from "node:fs/promises"
import { relative } from "node:path"
import { Command, CommanderError } from "commander"
import {
  assetQuestions,
  buildProbe,
  marketingQuestions,
  notificationQuestions,
  type ProbeQuestions
} from "../probe/build.ts"
import { parseProbe, summariseProbe } from "../probe/capture.ts"
import { buildTemplates, GMAIL_CLIP_BYTES } from "./build.ts"
import { connectToStore } from "./connect.ts"
import { DEFAULT_VALUES, resetValues, startPreview } from "./preview.ts"
import { SCOPES } from "./shopifyCli.ts"
import { createStoreSource, type StoreSource } from "./store.ts"
import { login, logout } from "./storeSetup.ts"
import { uploadAssets } from "./upload.ts"
import { runWizard } from "./wizard.ts"

/*
 * Every command this package answers to, and the wizard a bare `pnpm cli` gets instead.
 *
 * Reading live orders is also the preview's job rather than only a command's — see `./store.ts`.
 */

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
  const id = found.orders[0]?.id
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

type UploadOptions = {
  readonly store?: string
}

/*
 * Gmail will not render a `data:` image, so an icon has to live somewhere with a URL. The store's
 * own CDN is that somewhere: it is already serving the logo, and it outlives any template edit.
 */
const upload = async (files: readonly string[], { store }: UploadOptions): Promise<void> => {
  const { client } = await connectToStore(store)
  for (const asset of await uploadAssets(client, files)) {
    process.stdout.write(`${asset.name}\n${asset.url}\n\n`)
  }
}

const build = async (dir: string, out: string): Promise<void> => {
  const built = await buildTemplates({ dir, out })
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
}

const setupNotes = `
Run with no command at all to be walked through connecting a store and reading from it.

A store is named by its handle — the 8f3f5f-3 in admin.shopify.com/store/8f3f5f-3 — though a
whole URL or myshopify domain is accepted too.

login authorises this store through the Shopify CLI, which opens a browser and keeps the
grant itself. Nothing to create, and no token to paste. It needs the CLI on PATH:
npm install -g @shopify/cli

Only the last 60 days of orders are readable unless Shopify has granted the store
read_all_orders. Set SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN to skip the browser entirely,
which is how this runs unattended.

Run login with no options to switch between the stores already set up.
`

/* Rebuilt per run, because a Command holds the values it last parsed. */
const createProgram = (): Command => {
  const program = new Command()
    .name("shopify-emails")
    .description("Compile typed React Email templates into Shopify notification Liquid.")
    .configureOutput({ writeErr: () => undefined })
    .exitOverride()
    .addHelpText("after", setupNotes)

  program
    .command("login")
    .description("authorise a store in the browser, or switch to one already set up")
    .option("--store <handle>", "the store handle, which skips the prompt")
    .addHelpText("after", `\nAsks the Shopify CLI for ${SCOPES}. Nothing is ever written to the store.\n`)
    .action(async ({ store }: { store?: string }) => {
      await login(store)
    })

  program
    .command("logout")
    .description("forget a store, leaving its authorisation to the Shopify CLI")
    .option("--store <handle>", "the store handle, which skips the prompt")
    .action(async ({ store }: { store?: string }) => {
      await logout(store)
    })

  program
    .command("build")
    .description("compile every template into paste-ready Liquid")
    .option("--dir <src>", "where the templates are", "src/emails")
    .option("--out <dir>", "where to write them", "dist")
    .action(async ({ dir, out }: { dir: string; out: string }) => {
      await build(dir, out)
    })

  program
    .command("preview")
    .description("open the templates in a browser, against a pulled order")
    .option("--dir <src>", "where the templates are", "src/emails")
    .option("--values <file>", "the JSON pull wrote", DEFAULT_VALUES)
    .addHelpText(
      "after",
      "\nThe samples answer for anything the order does not carry, so a gift card or a campaign\nstill renders. Pull again and restart to pick up a newer order.\n"
    )
    .action(async (options: { dir: string; values: string }) => {
      await startPreview(options)
    })

  program
    .command("reset")
    .description("throw away a pulled order and preview against the samples again")
    .option("--values <file>", "the JSON to remove", DEFAULT_VALUES)
    .addHelpText(
      "after",
      "\nOne real order rarely carries a discount, a gift card, a partial fulfilment and a second\nline at once. The samples were built to, which is why they are worth going back to.\n"
    )
    .action(async ({ values }: { values: string }) => {
      await resetValues(values)
    })

  program
    .command("pull")
    .description("write what a live order hands a template, as JSON")
    .option("--store <handle>", "which stored store to read, rather than the active one")
    .option("--order <name|gid>", "an order name such as #1001, or a gid")
    .option("--out <file>", "write to a file instead of stdout")
    .addHelpText(
      "after",
      "\nNotification-only drops are not in it, because no API serves them: that is probe.\nA fixture goes stale the moment the order does, so this is for reading, not committing.\n"
    )
    .action(async (options: PullOptions) => {
      await pull(options)
    })

  program
    .command("upload")
    .description("host image assets on the store's CDN and print their URLs")
    .argument("<files...>", "the images to host")
    .option("--store <handle>", "which stored store to write to, rather than the active one")
    .addHelpText(
      "after",
      "\nGmail drops a `data:` image, so an icon carried inline as base64 never renders there.\nHost it here and name it by URL instead. Needs write_files: log in again if the store was\nauthorised before this command existed.\n"
    )
    .action(async (files: readonly string[], options: UploadOptions) => {
      await upload(files, options)
    })

  program
    .command("probe")
    .description("print the variable probe, or read a captured run back")
    .option("--for <target>", "notification, marketing, or asset", "notification")
    .option("--names <a,b>", "ask about only these drops")
    .option("--capture <file.html>", "read a saved preview instead of printing the probe")
    .option("--out <file>", "write to a file instead of stdout")
    .addHelpText(
      "after",
      "\nNotification templates have no API. probe prints a throwaway template to paste into one\nin the admin; preview it, save the rendered HTML, and pass it back with --capture.\n\n--for asset asks what the CDN filters resolve to instead of what the drops hold, and its\ncapture prints the resolved URLs as JSON rather than a present-or-absent report.\n"
    )
    .action(async (options: ProbeOptions) => {
      await probe(options)
    })

  return program
}

export const run = async (argv: readonly string[]): Promise<void> => {
  const program = createProgram()
  if (argv.length === 0) {
    /* Nothing to guide anybody through without a terminal to prompt in, so a script still gets help. */
    if (process.stdin.isTTY) {
      await runWizard()
      return
    }
    program.outputHelp()
    return
  }

  try {
    await program.parseAsync([...argv], { from: "user" })
  } catch (error) {
    /* Help arrives here only because `exitOverride` turns commander's own exit into a throw. */
    if (error instanceof CommanderError && error.code.startsWith("commander.help")) {
      return
    }
    throw error
  }
}

import { mkdir, writeFile } from "node:fs/promises"
import { dirname, relative } from "node:path"
import { cancel, intro, log, note, outro, select, spinner, text } from "@clack/prompts"
import pc from "picocolors"
import { assetQuestions, buildProbe, notificationQuestions } from "../probe/build.ts"
import { buildTemplates, GMAIL_CLIP_BYTES } from "./build.ts"
import { listStores, rememberStore, setActiveStore, storeHandle } from "./config.ts"
import { DEFAULT_VALUES, resetValues } from "./preview.ts"
import { authenticateStore } from "./shopifyCli.ts"
import { createStoreSource, type OrderSummary, type ShopSummary, type StoreSource } from "./store.ts"
import { ADD_STORE, answered, askDomain, CANCELLED, chooseStore, readShop } from "./storeSetup.ts"

/*
 * `pnpm cli` with nothing after it.
 *
 * The commands underneath are complete, but each of them assumes you already know which to run and
 * in what order. This asks instead, so a first run is a conversation rather than a manual.
 */

const working = async <Value>(message: string, done: string, task: () => Promise<Value>): Promise<Value> => {
  const progress = spinner()
  progress.start(message)
  try {
    const value = await task()
    progress.stop(done)
    return value
  } catch (failure) {
    progress.error(message)
    throw failure
  }
}

const write = async (file: string, contents: string): Promise<string> => {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, contents, "utf8")
  return relative(process.cwd(), file)
}

/* Every read is a Shopify CLI subprocess, which is slow enough to look like a hang if left unsaid. */
const readStore = (domain: string) =>
  working("Reading the store details through the Shopify CLI", "Read the store", () => readShop(domain))

/* The grant check is also the first real answer, so what it read is worth showing rather than dropping. */
const showShop = (shop: ShopSummary, domain: string): void =>
  note(
    [
      `Store    ${shop.name}`,
      `Handle   ${storeHandle(domain)}`,
      `Site     ${shop.url}`,
      `Email    ${shop.email}`,
      "",
      "Read from the store just now. These are the values a template prints in its footer."
    ].join("\n"),
    "Connected"
  )

const authorise = async (domain: string): Promise<string> => {
  log.step(`Authorising ${storeHandle(domain)} in a browser. The access it asks for is read-only.`)
  await authenticateStore(domain)
  const shop = await readStore(domain)
  await rememberStore(domain)
  showShop(shop, domain)
  return domain
}

const connect = async (): Promise<string> => {
  const known = await listStores()
  if (known.stores.length === 0) {
    return authorise(await askDomain())
  }

  const chosen = await chooseStore("Which store?", known, [{ label: "Add another store…", value: ADD_STORE }])
  if (chosen === ADD_STORE) {
    return authorise(await askDomain())
  }

  /* Re-checked rather than trusted, so a lapsed grant surfaces here and not halfway through a read. */
  const shop = await readStore(chosen)
  await setActiveStore(chosen)
  showShop(shop, chosen)
  return chosen
}

const orderDate = (createdAt: string): string =>
  new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

const orderOption = (order: OrderSummary) => ({
  hint: [
    `${order.items} ${order.items === 1 ? "item" : "items"}`,
    `${order.total} ${order.currency}`.trim(),
    order.financialStatus,
    orderDate(order.createdAt)
  ]
    .filter((part) => part !== "")
    .join(", "),
  label: order.customer ? `${order.name} for ${order.customer}` : order.name,
  value: order.id
})

const PAGE = 20
const MORE = "load-more"

/*
 * The picker grows rather than paging, because an order is chosen by recognising it, and a reader
 * who has scrolled past the first twenty is comparing them, not looking one up by number.
 */
const chooseOrder = async (source: StoreSource): Promise<string | undefined> => {
  const shown: OrderSummary[] = []
  let after: string | undefined

  for (;;) {
    const cursor = after
    const page = await working(cursor ? "Listing more orders" : "Listing recent orders", "Listed", () =>
      source.searchOrders({ after: cursor, first: PAGE })
    )
    shown.push(...page.orders)
    after = page.next

    if (shown.length === 0) {
      log.warn(`No orders are readable on ${source.domain}. Only the last 60 days are, without read_all_orders.`)
      return undefined
    }

    const options = shown.map(orderOption)
    const chosen = answered(
      await select({
        message: "Which order?",
        options: after
          ? [...options, { hint: `${shown.length} listed so far`, label: "Load more orders…", value: MORE }]
          : options
      })
    )
    if (chosen !== MORE) {
      return chosen
    }
  }
}

const pullOrder = async (source: StoreSource): Promise<void> => {
  const id = await chooseOrder(source)
  if (id === undefined) {
    return
  }

  const file = answered(await text({ initialValue: DEFAULT_VALUES, message: "Write it where?" }))
  const values = await working("Reading the order", "Read", () => source.loadOrderVariables(id))
  log.success(await write(file, `${JSON.stringify(values, null, 2)}\n`))
  log.info(
    "Run pnpm dev to open the templates against it. A fixture goes stale the moment the order does, so this is\nfor reading, not committing."
  )
}

const buildAll = async (): Promise<void> => {
  const built = await working("Compiling", "Compiled", () => buildTemplates({ dir: "src/emails", out: "dist" }))
  const noun = built.length === 1 ? "template" : "templates"
  log.success(
    `${built.length} ${noun} in dist. Paste each .liquid into a notification body, and its .subject.txt above it.`
  )

  const clip = Math.round(GMAIL_CLIP_BYTES / 1024)
  for (const template of built.filter(({ bytes }) => bytes > GMAIL_CLIP_BYTES)) {
    log.warn(
      `${template.id} is ${Math.round(template.bytes / 1024)} KB, past the ${clip} KB where Gmail clips a message.`
    )
  }
}

const probeSurfaces = { asset: assetQuestions, notification: notificationQuestions }

const roundTrip = (file: string, surface: string): string =>
  [
    "1. Open Settings, then Notifications, in the Shopify admin.",
    `2. Edit any notification and paste ${file} over its body, keeping the original somewhere first.`,
    "3. Preview it, and save the rendered page as HTML.",
    `4. Run: pnpm cli probe --for ${surface} --capture <that file>`,
    "5. Put the original body back."
  ].join("\n")

/* A notification renders nowhere an API can reach, so a paste into the admin is the only way to ask. */
const writeProbe = async (): Promise<void> => {
  const surface = answered(
    await select({
      message: "Which drops?",
      options: [
        {
          hint: "which of them a real order fills in",
          label: "Notification variables",
          value: "notification" as const
        },
        { hint: "what the image filters resolve to", label: "CDN asset URLs", value: "asset" as const }
      ]
    })
  )
  const file = await write(`.fixtures/${surface}-probe.liquid`, `${buildProbe(probeSurfaces[surface])}\n`)
  note(roundTrip(file, surface), "Nothing serves these, so a live render has to answer")
}

/* One bad order should cost that step, not the session. */
const attempt = async (task: () => Promise<void>): Promise<void> => {
  try {
    await task()
  } catch (error) {
    if (error === CANCELLED) {
      throw error
    }
    log.error(error instanceof Error ? error.message : String(error))
  }
}

const WHAT_THIS_DOES = [
  "Pull a live order so pnpm dev previews the templates against the values Shopify would really hand them, rather than invented ones.",
  "Write a variable probe to find out what a notification is passed at all, which no API will tell you.",
  "Build the templates to get the Liquid that gets pasted into the admin."
].join("\n\n")

const menu = async (store: string) =>
  answered(
    await select({
      message: "What next?",
      options: [
        { hint: "the real values, written to a file", label: "Pull a live order", value: "pull" as const },
        {
          hint: "back to the samples, which cover more",
          label: "Throw away the pulled order",
          value: "reset" as const
        },
        { hint: "asks a notification what it was passed", label: "Write a variable probe", value: "probe" as const },
        { hint: "compiles src/emails into paste-ready Liquid", label: "Build the templates", value: "build" as const },
        { hint: `currently ${storeHandle(store)}`, label: "Switch store", value: "store" as const },
        { label: "Done", value: "done" as const }
      ]
    })
  )

export const runWizard = async (): Promise<void> => {
  intro(pc.inverse(" shopify-emails "))
  try {
    let store = await connect()
    note(WHAT_THIS_DOES, "What you can do from here")

    for (;;) {
      const next = await menu(store)
      if (next === "done") {
        outro("Nothing is left running.")
        return
      }

      switch (next) {
        case "build":
          await attempt(buildAll)
          break
        case "probe":
          await attempt(writeProbe)
          break
        case "pull":
          await attempt(async () => pullOrder(await createStoreSource(store)))
          break
        case "reset":
          await attempt(async () => resetValues(DEFAULT_VALUES))
          break
        case "store":
          store = await connect()
          break
      }
    }
  } catch (error) {
    if (error !== CANCELLED) {
      throw error
    }
    cancel("Stopped. Nothing was changed.")
  }
}

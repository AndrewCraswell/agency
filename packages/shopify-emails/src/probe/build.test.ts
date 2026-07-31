import { describe, expect, it } from "vitest"
import { createShopifyEngine } from "../filters/engine.ts"
import { deprecatedNotificationDrops, documentedNotificationDrops } from "../samples/documentedDrops.ts"
import { candidateMarketingDrops } from "../samples/marketingDrops.ts"
import { observedNotificationDrops } from "../samples/observedDrops.ts"
import { templateSamples } from "../samples/templates.ts"
import { buildProbe, candidateNotificationDrops, marketingQuestions, notificationQuestions } from "./build.ts"

/** The probe escapes for HTML, so a browser hands back the JSON that a test has to undo by hand. */
const decode = (html: string): string =>
  html
    .replaceAll(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")

const asking = (names: readonly string[]) => ({ ...notificationQuestions, names })

describe("variable contracts", () => {
  it("only claims drops the real templates are known to receive", () => {
    const evidenced = new Set<string>([
      ...observedNotificationDrops,
      ...documentedNotificationDrops,
      ...deprecatedNotificationDrops
    ])
    const unevidenced = Object.keys(templateSamples.order_confirmation).filter((key) => !evidenced.has(key))

    expect(unevidenced).toEqual([])
  })

  it("asks about every drop a template reads and every drop Shopify documents", () => {
    const probe = buildProbe()

    for (const drop of [...observedNotificationDrops, ...documentedNotificationDrops, ...deprecatedNotificationDrops]) {
      expect(probe).toContain(`${JSON.stringify(drop)}: `)
    }
  })

  it("asks a marketing message about the drops its own templates read", () => {
    const probe = buildProbe(marketingQuestions)

    for (const drop of candidateMarketingDrops) {
      expect(probe).toContain(`${JSON.stringify(drop)}: `)
    }
    expect(probe).toContain(`"unsubscribe_url": {{ unsubscribe_url | json`)
  })

  it("names a documented drop once, however many lists claim it", () => {
    expect(candidateNotificationDrops).toEqual([...new Set(candidateNotificationDrops)].toSorted())
  })

  it("probes exactly the drops it is given", () => {
    const probe = buildProbe(asking(["note", "line_items"]))

    expect(probe).toContain(`"note": {{ note | json | escape | default: "null" }}`)
    expect(probe).toContain(`"line_items": {{ line_items | json | escape | default: "null" }}`)
    expect(probe).not.toContain(`"customer"`)
  })

  it("reaches into a drop json refuses, property by property", () => {
    const probe = buildProbe(asking(["shop"]))

    expect(probe).not.toContain(`{{ shop | json`)
    expect(probe).toContain(`"name": {{ shop.name | json | escape | default: "null" }}`)
    expect(probe).toContain(`"address": {{ shop.address | json | escape | default: "null" }}`)
  })

  it("renders one JSON object, so the answer can be pasted into a type generator", async () => {
    const rendered = await createShopifyEngine().parseAndRender(buildProbe(asking(["shop", "line_items"])), {
      line_items: [{ quantity: 2, title: "Foil" }],
      shop: { name: "Fencing Club" }
    })
    const body = rendered.slice(rendered.indexOf(">") + 1, rendered.lastIndexOf("</pre>"))
    const answered = JSON.parse(decode(body))

    expect(answered.line_items).toEqual([{ quantity: 2, title: "Foil" }])
    expect(answered.shop.name).toBe("Fencing Club")
    expect(answered.shop.currency).toBeNull()
  })

  it("reports a drop that was never supplied as null, so absent reads differently from blank", async () => {
    const rendered = await createShopifyEngine().parseAndRender(buildProbe(asking(["note"])), {})
    const body = rendered.slice(rendered.indexOf(">") + 1, rendered.lastIndexOf("</pre>"))

    expect(JSON.parse(decode(body))).toEqual({ note: null })
  })
})

import { buildProbe, marketingQuestions } from "@repo/shopify-emails/probe"
import { describe, expect, it } from "vitest"

/*
 * The probe templates, committed so they can be pasted without running anything first.
 *
 * Nothing in this package can settle what Shopify hands a notification. Reading the stock templates
 * only shows drops somebody already used, and the public Liquid reference documents a different
 * dialect. Pasting this into a notification in the admin and previewing or sending it produces one
 * JSON object describing the variables, which is what `@repo/shopify-emails/variables` mirrors.
 *
 * A failure here means the drop list moved. Read the diff, and if it is the change you meant, run
 * `vitest -u`.
 */

describe("variable probe", () => {
  it("matches the committed notification template", async () => {
    await expect(buildProbe()).toMatchFileSnapshot("./__snapshots__/probe.liquid")
  })

  it("matches the committed marketing template", async () => {
    await expect(buildProbe(marketingQuestions)).toMatchFileSnapshot("./__snapshots__/probeMarketing.liquid")
  })
})

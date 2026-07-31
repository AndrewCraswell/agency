import { describe, expect, it } from "vitest"
import { allTemplates } from "./templates.ts"

/*
 * The Liquid that gets pasted into Shopify, committed to disk. Fifty templates hang off a handful
 * of shared components, so a one-line change to a component rewrites most of the library at once.
 * Without a stored copy that edit lands invisibly; with one it arrives as a diff somebody reads.
 *
 * A failure here is not a defect on its own. Read the diff, and if the change is the one you meant,
 * run `vitest -u`.
 */

describe.each(allTemplates.map((template) => [template.id, template] as const))("%s", (id, template) => {
  it("compiles to the committed Liquid", async () => {
    await expect(await template.compile()).toMatchFileSnapshot(`./__snapshots__/${id}.liquid`)
  })

  it("compiles the committed subject", async () => {
    await expect(template.subject()).toMatchFileSnapshot(`./__snapshots__/${id}.subject.txt`)
  })
})

import { createHash } from "node:crypto"
import { z } from "zod"
import type { ArtifactStore } from "../documents/artifact-store.js"
import { scraperEventWindow } from "./scraper-event-window.js"

const scopeSchema = z
  .strictObject({
    jurisdiction: z.string().regex(/^[a-z]{2}$/),
    session: z.string().regex(/^[A-Za-z0-9-]+$/),
    // A fresh cycle must have a new identity so previously empty days can acquire meetings.
    cycle: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{0,100}$/),
    start: z.iso.date(),
    end: z.iso.date(),
    daysPerWindow: z.number().int().min(1).max(7)
  })
  .refine(({ start, end }) => start <= end, "Meeting plan range is reversed")
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const planSchema = z.strictObject({
  scope: scopeSchema,
  id: digest,
  windows: z.array(z.strictObject({ id: digest, window: scraperEventWindow })).min(1)
})

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

/** Calendar partitioning is jurisdiction independent; adapters enforce their reviewed session bounds. */
export function createEventWindowPlan(input: z.input<typeof scopeSchema>) {
  const scope = scopeSchema.parse(input)
  const id = hash(scope)
  const windows = []
  const finalDay = Date.parse(scope.end)
  for (let day = Date.parse(scope.start); day <= finalDay; day += scope.daysPerWindow * 86_400_000) {
    const window = scraperEventWindow.parse({
      start: new Date(day).toISOString().slice(0, 10),
      end: new Date(Math.min(finalDay, day + (scope.daysPerWindow - 1) * 86_400_000)).toISOString().slice(0, 10)
    })
    windows.push({ id: hash([id, window]), window })
  }
  return { scope, id, windows }
}

export function parseEventWindowPlan(input: unknown) {
  const plan = planSchema.parse(input)
  const expected = createEventWindowPlan(plan.scope)
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error("Meeting plan identity or exact calendar partition does not match")
  }
  return expected
}

export async function retainEventWindowPlan(
  store: Pick<ArtifactStore, "put" | "read">,
  input: z.input<typeof scopeSchema>
) {
  const plan = createEventWindowPlan(input)
  const path = `openstates/event-window-plans/${plan.scope.jurisdiction}/${plan.scope.session}/${plan.id}/plan.json`
  const bytes = Buffer.from(JSON.stringify(plan))
  if (!(await store.put(path, bytes))) {
    const existing = parseEventWindowPlan(JSON.parse(Buffer.from(await store.read(path)).toString("utf8")))
    if (JSON.stringify(existing) !== bytes.toString("utf8"))
      throw new Error("Existing meeting plan conflicts with requested plan")
  }
  return { path, plan }
}

export async function readEventWindowPlan(store: Pick<ArtifactStore, "read">, path: string) {
  return parseEventWindowPlan(JSON.parse(Buffer.from(await store.read(path)).toString("utf8")))
}

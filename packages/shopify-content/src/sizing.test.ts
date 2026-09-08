import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { loadManifest, validateManifest } from "./bundle.ts"
import { isReference } from "./dependencies.ts"
import { applyInstallation, planInstallation, type AdapterRegistry, type InstalledResource } from "./installer.ts"

const root = new URL("../../fc-theme-base/content/", import.meta.url)
const sourceSchema = z.object({
  charts: z.array(
    z.object({
      handle: z.string(),
      measurements: z.array(z.tuple([z.string(), z.string()])),
      rows: z.array(z.array(z.string())),
      imperialMeasurements: z.array(z.tuple([z.string(), z.string()])).optional(),
      imperialRows: z.array(z.array(z.string())).optional()
    })
  )
})

describe("Fencing Club content package", () => {
  it("preserves every approved metric and imperial value in editable size-entry fields", async () => {
    const raw: unknown = JSON.parse(await readFile(new URL("sizing-source.json", root), "utf8"))
    const source = sourceSchema.parse(raw)
    const { manifest, directory } = await loadManifest(fileURLToPath(new URL("manifest.json", root)))
    validateManifest(manifest, directory)
    const byKey = new Map(manifest.resources.map((resource) => [resource.key, resource]))
    expect(source.charts).toHaveLength(13)
    expect(manifest.resources.filter((resource) => resource.key.startsWith("size."))).toHaveLength(94)
    for (const chart of source.charts) {
      const record = byKey.get(`chart.${chart.handle}`)!
      expect(record.data.status).toBe("DRAFT")
      const fields = z.record(z.string(), z.unknown()).parse(record.data.fields)
      const entries = z.array(z.unknown()).parse(fields.entries)
      expect(entries).toHaveLength(chart.rows.length)
      for (const [index, row] of chart.rows.entries()) {
        const reference = entries[index]
        if (!isReference(reference)) {
          throw new Error("Size entry must be a reference.")
        }
        const values = z.record(z.string(), z.string()).parse(byKey.get(reference.$ref)?.data.fields)
        expect(values.size_label).toBe(row[0])
        for (const [column, [key]] of chart.measurements.entries()) {
          expect(values[key]).toBe(row[column + 1])
        }
        const imperial = chart.imperialRows?.[index]
        for (const [column, [key]] of (chart.imperialMeasurements ?? []).entries()) {
          expect(values[key]).toBe(imperial?.[column + 1])
        }
      }
    }
    expect(byKey.get("page.size-charts")?.data.isPublished).toBe(false)
    expect(manifest.resources.some((resource) => resource.kind === "product-chart-assignment")).toBe(false)
  })

  it("packages shared category groups with consistent Mens, Womens and Kids wording", async () => {
    const { manifest } = await loadManifest(fileURLToPath(new URL("manifest.json", root)))
    const groups = manifest.resources.filter(
      (resource) => resource.data.type === "size_chart_group" && resource.kind === "metaobject"
    )
    expect(groups.map((resource) => resource.data.fields)).toEqual([
      { title: "Masks", selection: "category", category: "Masks" },
      { title: "Jackets", selection: "category", category: "Jackets" },
      { title: "Pants", selection: "category", category: "Pants" },
      { title: "Gloves", selection: "category", category: "Gloves" },
      { title: "Underarm Protectors", selection: "category", category: "Underarm Protectors" },
      { title: "Chest Protectors", selection: "category", category: "Chest Protectors" },
      { title: "Footwear", selection: "category", category: "Footwear" }
    ])
    const charts = manifest.resources.filter(
      (resource) => resource.kind === "metaobject" && resource.data.type === "size_chart"
    )
    const categories = groups.map((resource) => z.object({ category: z.string() }).parse(resource.data.fields).category)
    for (const chart of charts) {
      expect(categories).toContain(z.object({ category: z.string() }).parse(chart.data.fields).category)
    }
    const byKey = new Map(
      charts.map((resource) => [resource.key, z.record(z.string(), z.unknown()).parse(resource.data.fields)])
    )
    expect(byKey.get("chart.gloves")?.category).toBe("Gloves")
    expect(byKey.get("chart.standard-socks")?.category).toBe("Footwear")
    expect(byKey.get("chart.elite-socks")?.category).toBe("Footwear")
    const menu = manifest.resources.find((resource) => resource.key === "menu.size-charts")
    const items = z.array(z.object({ title: z.string(), items: z.array(z.unknown()) })).parse(menu?.data.items)
    expect(items.map((item) => item.title)).toEqual(categories)
    expect(items.reduce((count, item) => count + item.items.length, 0)).toBe(13)
    for (const category of ["jackets", "pants"]) {
      for (const [prefix, label] of [
        ["mens", "Mens"],
        ["womens", "Womens"],
        ["kids", "Kids"]
      ]) {
        const chart = manifest.resources.find((resource) => resource.key === `chart.${prefix}-${category}`)
        const fields = z.record(z.string(), z.unknown()).parse(chart?.data.fields)
        expect(fields.navigation_label).toBe(label)
        expect(fields.title).toBe(`${label} ${category}`)
      }
    }
    for (const [prefix, label] of [
      ["mens", "Mens"],
      ["womens", "Womens"]
    ]) {
      expect(byKey.get(`chart.${prefix}-chest-protectors`)?.title).toBe(`${label} chest protectors`)
      expect(byKey.get(`chart.${prefix}-chest-protectors`)?.navigation_label).toBe(label)
    }
    expect(byKey.get("chart.standard-socks")?.measurement_labels).toContain("US Mens size")
    expect(byKey.get("chart.elite-socks")?.measurement_labels).toContain("US Mens size")
    expect(JSON.stringify(manifest)).not.toMatch(/\b(?:men['\u2019]s|women['\u2019]s|kids['\u2019])/i)
    const definition = manifest.resources.find((resource) => resource.key === "definition.group")
    expect(definition?.dependsOn ?? []).toEqual([])
    expect(JSON.stringify(definition?.data)).toContain('"$ref":"definition.chart"')
  })

  it("installs in dependency order, resolves all destination IDs, and performs no writes on rerun", async () => {
    const { manifest } = await loadManifest(fileURLToPath(new URL("manifest.json", root)))
    const store = new Map<string, InstalledResource>()
    const written: Record<string, unknown>[] = []
    const registry: AdapterRegistry = {}
    for (const kind of new Set(manifest.resources.map((resource) => resource.kind))) {
      const identity = (data: Record<string, unknown>) =>
        `${kind}:${data.type ?? ""}:${data.handle ?? data.filename ?? data.key ?? ""}`
      registry[kind] = {
        identity,
        validate: (data) => {
          z.record(z.string(), z.unknown()).parse(data)
        },
        find: async (data) => store.get(identity(data)),
        create: async (data) => {
          expect(JSON.stringify(data)).not.toContain('"$ref"')
          expect(JSON.stringify(data)).not.toContain("pending:")
          const item = { id: `destination-${store.size}`, url: `/destination/${store.size}`, state: data }
          written.push(data)
          store.set(identity(data), item)
          return item
        }
      }
    }
    await applyInstallation(await planInstallation(manifest.resources, registry), registry)
    expect(written).toHaveLength(131)
    const second = await planInstallation(manifest.resources, registry)
    expect(second.every((item) => item.action === "keep")).toBe(true)
    await applyInstallation(second, registry)
    expect(written).toHaveLength(131)
  })
})

import { z } from "zod"
import type { AdminClient } from "./client.ts"

const object = z.record(z.string(), z.unknown())
const configSchema = z.strictObject({
  directoryPage: z.string(),
  groups: z.array(z.string()).min(1).max(50),
  headerMenu: z.string(),
  footerMenus: z.record(z.string(), z.string())
})
const readQuery = `query ThemeConfiguration($id: ID!) { theme(id: $id) { id name role files(filenames: ["config/settings_data.json", "templates/page.size-charts.json", "templates/metaobject/size_chart.json", "sections/header-group.json", "sections/footer-group.json"], first: 10) { nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } }`
const resourcesQuery = `query ThemeResources { groups: metaobjects(type: "size_chart_group", first: 100) { nodes { id handle } pageInfo { hasNextPage } } menus(first: 100) { nodes { handle } pageInfo { hasNextPage } } pages(first: 100) { nodes { handle templateSuffix } pageInfo { hasNextPage } } }`
const writeQuery = `mutation ConnectSizingTheme($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) { themeFilesUpsert(themeId: $themeId, files: $files) { upsertedThemeFiles { filename } userErrors { field message } } }`
const themeResponse = z.object({
  theme: z.object({
    id: z.string(),
    role: z.string(),
    files: z.object({ nodes: z.array(z.object({ filename: z.string(), body: z.object({ content: z.string() }) })) })
  })
})
const complete = z.object({ hasNextPage: z.literal(false) })

export function configureThemeFiles(
  files: { filename: string; body: { content: string } }[],
  configInput: unknown,
  groups: { id: string; handle: string }[]
) {
  const config = configSchema.parse(configInput)
  const ids = config.groups.map((handle) => {
    const matches = groups.filter((group) => group.handle === handle)
    if (matches.length !== 1 || !matches[0]) {
      throw new Error(`Missing or ambiguous sizing group: ${handle}.`)
    }
    return matches[0].handle
  })
  const parse = (filename: string) => {
    const found = files.find((file) => file.filename === filename)
    if (!found) {
      throw new Error(`Theme file missing: ${filename}.`)
    }
    return object.parse(JSON.parse(found.body.content.replace(/^\s*\/\*[\s\S]*?\*\//, "")))
  }
  const settings = parse("config/settings_data.json")
  let current = settings.current
  if (typeof current === "string") {
    current = object.parse(settings.presets)[current]
  }
  settings.current = { ...object.parse(current), size_chart_groups: ids, size_chart_index_page: config.directoryPage }
  const header = parse("sections/header-group.json")
  const headerSections = object.parse(header.sections)
  const headerSection = object.parse(headerSections.header)
  headerSection.settings = { ...object.parse(headerSection.settings), menu: config.headerMenu }
  headerSections.header = headerSection
  header.sections = headerSections
  const footer = parse("sections/footer-group.json")
  const footerSections = object.parse(footer.sections)
  const footerSection = object.parse(footerSections.footer)
  const blocks = object.parse(footerSection.blocks)
  for (const [id, menu] of Object.entries(config.footerMenus)) {
    const block = object.parse(blocks[id])
    block.settings = { ...object.parse(block.settings), menu }
    blocks[id] = block
  }
  footerSection.blocks = blocks
  footerSections.footer = footerSection
  footer.sections = footerSections
  return [
    { filename: "config/settings_data.json", body: { type: "TEXT", value: `${JSON.stringify(settings, null, 2)}\n` } },
    { filename: "sections/header-group.json", body: { type: "TEXT", value: `${JSON.stringify(header, null, 2)}\n` } },
    { filename: "sections/footer-group.json", body: { type: "TEXT", value: `${JSON.stringify(footer, null, 2)}\n` } }
  ]
}

export async function applyThemeConfiguration(client: AdminClient, themeId: string, input: unknown, apply: boolean) {
  const config = configSchema.parse(input)
  const before = themeResponse.parse(await client(readQuery, { id: themeId })).theme
  if (before.role === "MAIN") {
    throw new Error("Configure an unpublished theme, not the live theme.")
  }
  const resources = z
    .object({
      groups: z.object({ nodes: z.array(z.object({ id: z.string(), handle: z.string() })), pageInfo: complete }),
      menus: z.object({ nodes: z.array(z.object({ handle: z.string() })), pageInfo: complete }),
      pages: z.object({
        nodes: z.array(z.object({ handle: z.string(), templateSuffix: z.string().nullable() })),
        pageInfo: complete
      })
    })
    .parse(await client(resourcesQuery))
  for (const handle of [config.headerMenu, ...Object.values(config.footerMenus)]) {
    if (!resources.menus.nodes.some((menu) => menu.handle === handle)) {
      throw new Error(`Menu is not installed: ${handle}.`)
    }
  }
  if (
    !resources.pages.nodes.some((page) => page.handle === config.directoryPage && page.templateSuffix === "size-charts")
  ) {
    throw new Error("Sizing directory page is not configured.")
  }
  const files = configureThemeFiles(before.files.nodes, config, resources.groups.nodes)
  if (!apply) {
    return { before: before.files.nodes, files }
  }
  const current = themeResponse.parse(await client(readQuery, { id: themeId })).theme
  if (JSON.stringify(current) !== JSON.stringify(before)) {
    throw new Error("Theme changed during configuration. Plan again.")
  }
  const response = z
    .object({
      themeFilesUpsert: z.object({
        userErrors: z.array(z.object({ message: z.string() })),
        upsertedThemeFiles: z.array(z.object({ filename: z.string() })).nullable()
      })
    })
    .parse(await client(writeQuery, { themeId, files }, true)).themeFilesUpsert
  if (response.userErrors.length || response.upsertedThemeFiles?.length !== files.length) {
    throw new Error(response.userErrors.map((error) => error.message).join("; ") || "Theme update was not confirmed.")
  }
  const after = themeResponse.parse(await client(readQuery, { id: themeId })).theme
  for (const expected of files) {
    const actual = after.files.nodes.find((file) => file.filename === expected.filename)
    if (
      !actual ||
      JSON.stringify(JSON.parse(actual.body.content.replace(/^\s*\/\*[\s\S]*?\*\//, ""))) !==
        JSON.stringify(JSON.parse(expected.body.value))
    ) {
      throw new Error(`Theme configuration did not round-trip: ${expected.filename}.`)
    }
  }
  return { before: before.files.nodes, files }
}

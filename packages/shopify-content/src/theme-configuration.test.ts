import { describe, expect, it } from "vitest"
import { applyThemeConfiguration, configureThemeFiles } from "./theme-configuration.ts"

const config = {
  directoryPage: "size-charts",
  groups: ["jackets"],
  headerMenu: "main-menu",
  footerMenus: { shop: "footer-shop" }
}
const files = [
  {
    filename: "config/settings_data.json",
    body: { content: JSON.stringify({ current: "Dawn", presets: { Dawn: { color: "untouched" } } }) }
  },
  {
    filename: "sections/header-group.json",
    body: {
      content: JSON.stringify({ sections: { header: { settings: { menu: "old", sticky: true } } }, order: ["header"] })
    }
  },
  {
    filename: "sections/footer-group.json",
    body: {
      content: JSON.stringify({
        sections: {
          footer: {
            settings: { legal_menu: "preserved" },
            blocks: { shop: { settings: { menu: "old", heading: "Shop" } } }
          }
        },
        order: ["footer"]
      })
    }
  }
]

describe("theme configuration", () => {
  it("plans without writes and verifies a successful application", async () => {
    const resources = {
      groups: { nodes: [{ id: "group", handle: "jackets" }], pageInfo: { hasNextPage: false } },
      menus: { nodes: [{ handle: "main-menu" }, { handle: "footer-shop" }], pageInfo: { hasNextPage: false } },
      pages: { nodes: [{ handle: "size-charts", templateSuffix: "size-charts" }], pageInfo: { hasNextPage: false } }
    }
    let stored = structuredClone(files)
    let writes = 0
    const client = async (query: string, _variables?: Record<string, unknown>, mutation?: boolean) => {
      if (query.includes("ThemeResources")) {
        return resources
      }
      if (mutation) {
        writes++
        stored = configureThemeFiles(stored, config, resources.groups.nodes).map((file) => ({
          filename: file.filename,
          body: { content: file.body.value }
        }))
        return {
          themeFilesUpsert: { userErrors: [], upsertedThemeFiles: stored.map(({ filename }) => ({ filename })) }
        }
      }
      return { theme: { id: "theme", role: "DEVELOPMENT", files: { nodes: stored } } }
    }
    expect((await applyThemeConfiguration(client, "theme", config, false)).files).toHaveLength(3)
    expect(writes).toBe(0)
    expect((await applyThemeConfiguration(client, "theme", config, true)).files).toHaveLength(3)
    expect(writes).toBe(1)
  })

  it.each(["menu", "page", "drift", "write", "read-back"])("rejects a %s configuration failure", async (defect) => {
    let reads = 0
    const client = async (query: string, _variables?: Record<string, unknown>, mutation?: boolean) => {
      if (query.includes("ThemeResources")) {
        return {
          groups: { nodes: [{ id: "group", handle: "jackets" }], pageInfo: { hasNextPage: false } },
          menus: {
            nodes: defect === "menu" ? [] : [{ handle: "main-menu" }, { handle: "footer-shop" }],
            pageInfo: { hasNextPage: false }
          },
          pages: {
            nodes: defect === "page" ? [] : [{ handle: "size-charts", templateSuffix: "size-charts" }],
            pageInfo: { hasNextPage: false }
          }
        }
      }
      if (mutation) {
        return {
          themeFilesUpsert: {
            userErrors: defect === "write" ? [{ message: "Denied" }] : [],
            upsertedThemeFiles: files.map(({ filename }) => ({ filename }))
          }
        }
      }
      reads++
      return {
        theme: {
          id: defect === "drift" && reads === 2 ? "changed" : "theme",
          role: "DEVELOPMENT",
          files: { nodes: files }
        }
      }
    }
    await expect(applyThemeConfiguration(client, "theme", config, true)).rejects.toThrow(
      /Menu is not installed|directory page is not configured|Theme changed|Denied|did not round-trip/
    )
  })

  it("updates only menu attachments and sizing fields while preserving preset and other settings", () => {
    const result = configureThemeFiles(files, config, [{ id: "destination-group", handle: "jackets" }])
    expect(JSON.parse(result[0]!.body.value)).toEqual({
      current: {
        color: "untouched",
        size_chart_groups: ["jackets"],
        size_chart_index_page: "size-charts"
      },
      presets: { Dawn: { color: "untouched" } }
    })
    expect(JSON.parse(result[1]!.body.value).sections.header.settings).toEqual({ menu: "main-menu", sticky: true })
    expect(JSON.parse(result[2]!.body.value).sections.footer.settings).toEqual({ legal_menu: "preserved" })
    expect(files[0]!.body.content).toContain('"current":"Dawn"')
  })
  it("rejects missing resources", () => {
    expect(() => configureThemeFiles(files, config, [])).toThrow("Missing or ambiguous")
    expect(() => configureThemeFiles([], config, [{ id: "group", handle: "jackets" }])).toThrow("file missing")
  })
  it("refuses the live theme", async () => {
    await expect(
      applyThemeConfiguration(
        async () => ({ theme: { id: "theme", role: "MAIN", files: { nodes: files } } }),
        "theme",
        config,
        true
      )
    ).rejects.toThrow("not the live theme")
  })
})

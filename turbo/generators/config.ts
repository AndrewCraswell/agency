import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import type { PlopTypes } from "@turbo/gen"

const packageNamePattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const textFileExtensions = new Set([".css", ".d.ts", ".html", ".json", ".liquid", ".md", ".toml", ".ts", ".tsx"])

function displayNameFromPackageName(packageName: string): string {
  return packageName
    .split("-")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ")
}

function isTextFile(fileName: string): boolean {
  return [...textFileExtensions].some((extension) => fileName.endsWith(extension))
}

async function replaceTokens(directory: string, packageName: string, displayName: string): Promise<void> {
  const { readdir } = await import("node:fs/promises")
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await replaceTokens(path, packageName, displayName)
        return
      }

      if (!isTextFile(entry.name)) {
        return
      }

      const content = await readFile(path, "utf8")
      const rendered = content.replaceAll("__PACKAGE_NAME__", packageName).replaceAll("__DISPLAY_NAME__", displayName)
      await writeFile(path, rendered, "utf8")
    })
  )
}

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("shopify-app", {
    description: "Create an Agency-standard embedded Shopify app in apps/",
    prompts: [
      {
        type: "input",
        name: "packageName",
        message: "Package name (kebab-case)",
        validate(value: string) {
          return packageNamePattern.test(value) || "Use kebab-case beginning with a letter."
        }
      },
      {
        type: "input",
        name: "displayName",
        message: "Display name",
        default(answers: { packageName?: string }) {
          return displayNameFromPackageName(answers.packageName ?? "shopify-app")
        }
      }
    ],
    actions: [
      async (answers) => {
        const packageName = String(answers.packageName)
        const displayName = String(answers.displayName)
        const root = String(answers.turbo.paths.root)
        const template = join(root, "turbo", "generators", "templates", "shopify-app")
        const destination = join(root, "apps", packageName)

        if (basename(destination) !== packageName || !packageNamePattern.test(packageName)) {
          throw new Error("Invalid Shopify app package name.")
        }

        try {
          await stat(destination)
          throw new Error(`apps/${packageName} already exists.`)
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "ENOENT") {
            await mkdir(destination, { recursive: false })
          } else {
            throw error
          }
        }

        try {
          await cp(template, destination, { recursive: true, errorOnExist: true })
          await replaceTokens(destination, packageName, displayName)
        } catch (error) {
          await rm(destination, { recursive: true, force: true })
          throw error
        }

        return `Created apps/${packageName}`
      }
    ]
  })
}

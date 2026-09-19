import { fileURLToPath } from "node:url"
import { baseConfig } from "@repo/storybook-config/main"
import type { StorybookConfig } from "@storybook/nextjs-vite"
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin"

const config: StorybookConfig = {
  ...baseConfig,
  framework: "@storybook/nextjs-vite",
  stories: ["../src/modules/conversations/stories/**/*.stories.tsx"],
  staticDirs: ["../public"],
  async viteFinal(config) {
    const { mergeConfig } = await import("vite")
    return mergeConfig(config, {
      plugins: [vanillaExtractPlugin()],
      server: {
        watch: {
          ignored: [/[\\/]\.next(?:[\\/]|$)/]
        }
      },
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("../src", import.meta.url)),
          "@sentry/nextjs": fileURLToPath(import.meta.resolve("@sentry/core"))
        },
        dedupe: ["react", "react-dom"]
      }
    })
  }
}

export default config

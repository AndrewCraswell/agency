import { defineMain } from "@repo/storybook-config/main"

export default defineMain({
  stories: ["../app/**/*.stories.@(ts|tsx)"],
  viteFinal(config) {
    config.resolve ??= {}
    config.resolve.dedupe = [...(config.resolve.dedupe ?? []), "react", "react-dom"]
    config.plugins = config.plugins?.flat().filter((plugin) => {
      if (!plugin || typeof plugin === "function" || typeof plugin.name !== "string") {
        return true
      }

      return plugin.name !== "prerender" && !plugin.name.startsWith("react-router")
    })

    return config
  }
})

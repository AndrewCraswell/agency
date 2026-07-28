import { defineMain } from "@repo/storybook-config/main"

export default defineMain({
  stories: ["../src/templates/**/*.stories.@(ts|tsx)"],
  // Storybook reuses the package's vite.config.ts, which pins the preview viewer to port 4180.
  // Storybook picks its own port, so those settings have to come back off here.
  viteFinal: (config) => ({
    ...config,
    server: { ...config.server, port: undefined, strictPort: false }
  })
})

import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { previewApi } from "./src/preview/previewApi.ts"

/*
 * The viewer is a dev-only tool, so there is no production build here: `pnpm build` still means
 * "assemble the Liquid for pasting into Shopify". Liquid is rendered in the Vite dev server
 * process because liquidjs reads the templates off disk, so `previewApi` mounts those endpoints
 * as middleware and the React app fetches them.
 */
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset({ target: "19" })] }), previewApi()],
  resolve: {
    // Storybook's shared config package carries its own React copy; without this the preview
    // loads two React instances and every compiled component fails on a null dispatcher.
    dedupe: ["react", "react-dom"]
  },
  server: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true
  }
})

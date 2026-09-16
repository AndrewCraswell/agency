import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { withSentryConfig } from "@sentry/nextjs/config"
import { createVanillaExtractPlugin } from "@vanilla-extract/next-plugin"
import type { NextConfig } from "next"

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const withVanillaExtract = createVanillaExtractPlugin({
  unstable_turbopack: { mode: "auto" }
})

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["tiktoken"],
  transpilePackages: ["@repo/legislation-core"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/**/*"]
  },
  outputFileTracingRoot: workspaceRoot,
  reactCompiler: true,
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: workspaceRoot
  }
}

export default withSentryConfig(withVanillaExtract(nextConfig), {
  org: "legislation",
  project: "legislation",
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  authToken: process.env.SENTRY_AUTH_TOKEN,
  webpack: {
    autoInstrumentServerFunctions: false,
    autoInstrumentMiddleware: false,
    autoInstrumentAppDirectory: false
  }
})

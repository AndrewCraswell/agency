import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { NextConfig } from "next"

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@swc/helpers/**/*"]
  },
  outputFileTracingRoot: workspaceRoot,
  reactCompiler: true,
  skipTrailingSlashRedirect: true,
  turbopack: {
    root: workspaceRoot
  },
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".ts", ".tsx"]
    }
    return config
  }
}

export default nextConfig

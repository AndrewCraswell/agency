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
  turbopack: {
    root: workspaceRoot
  }
}

export default nextConfig

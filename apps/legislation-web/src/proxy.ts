import type { ProxyConfig } from "next/server"

export { proxy } from "./modules/request-handling/proxy"

export const config = {
  matcher: "/api/:path*"
} satisfies ProxyConfig

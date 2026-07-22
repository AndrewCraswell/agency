import "@shopify/shopify-app-react-router/adapters/node"
import { ApiVersion, AppDistribution, shopifyApp } from "@shopify/shopify-app-react-router/server"
import { MemorySessionStorage } from "@shopify/shopify-app-session-storage-memory"
import { env } from "./env.server"

const shopify = shopifyApp({
  apiKey: env.SHOPIFY_API_KEY,
  apiSecretKey: env.SHOPIFY_API_SECRET,
  apiVersion: ApiVersion.April26,
  scopes: env.SCOPES?.split(","),
  appUrl: env.SHOPIFY_APP_URL,
  authPathPrefix: "/auth",
  sessionStorage: new MemorySessionStorage(),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true
  },
  ...(env.SHOP_CUSTOM_DOMAIN ? { customShopDomains: [env.SHOP_CUSTOM_DOMAIN] } : {})
})

export default shopify
export const apiVersion = ApiVersion.April26
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders
export const authenticate = shopify.authenticate
export const login = shopify.login
export const sessionStorage = shopify.sessionStorage

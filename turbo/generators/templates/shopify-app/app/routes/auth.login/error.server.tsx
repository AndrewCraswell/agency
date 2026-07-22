import type { LoginError } from "@shopify/shopify-app-react-router/server"
import { LoginErrorType } from "@shopify/shopify-app-react-router/server"

export type LoginErrorMessage = {
  shop?: string
}

export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "Enter your shop domain to log in" }
  }

  if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "Enter a valid shop domain to log in" }
  }

  return {}
}

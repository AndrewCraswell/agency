import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen.js"

export function getRouter() {
  return createRouter({
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true
  })
}

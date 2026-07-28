import { readFile } from "node:fs/promises"
import type { ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { escapeHtml } from "../liquid.ts"
import { adminUrl, templates } from "../registry.ts"
import { findTemplate, findVariation, render, stylesPath } from "../render.ts"
import type { Template, TemplateVariation } from "../types.ts"
import type { PreviewSummary, TemplateSummary } from "./contract.ts"
import { wrapPrintout } from "./previewDocument.ts"

function summarize(template: Template): TemplateSummary {
  const [first, ...rest] = template.variations
  return {
    id: template.id,
    name: template.name,
    group: template.group,
    type: template.type,
    search: [template.name, template.group, template.id, template.dir].join(" ").toLowerCase(),
    adminUrl: adminUrl(template),
    variations: [{ id: first.id, name: first.name }, ...rest.map(({ id, name }) => ({ id, name }))]
  }
}

function send(response: ServerResponse, status: number, contentType: string, body: string): void {
  response.writeHead(status, { "Content-Type": contentType, "Cache-Control": "no-store" })
  response.end(body)
}

const TEMPLATES_ROUTE = "/api/templates"
const STYLES_ROUTE = "/assets/notifications/styles.css"
const PREVIEW_PREFIX = "/api/preview/"
const RAW_PREFIX = "/raw/"

/** Decided before any await so the middleware can hand unclaimed requests straight back to Vite. */
function ownsRoute(pathname: string): boolean {
  if (pathname === TEMPLATES_ROUTE || pathname === STYLES_ROUTE) {
    return true
  }
  return pathname.startsWith(PREVIEW_PREFIX) || pathname.startsWith(RAW_PREFIX)
}

/** `<template-id>/<variation-id>` — the variation part is optional. */
function resolveRoute(path: string): { template: Template; variation: TemplateVariation } | undefined {
  const [templateId, variationId] = path.split("/")
  const template = findTemplate(templateId)
  if (!template) {
    return undefined
  }
  return { template, variation: findVariation(template, variationId) }
}

async function respond(pathname: string, response: ServerResponse): Promise<void> {
  if (pathname === TEMPLATES_ROUTE) {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(templates.map(summarize)))
    return
  }

  if (pathname === STYLES_ROUTE) {
    send(response, 200, "text/css; charset=utf-8", await readFile(stylesPath, "utf8"))
    return
  }

  if (pathname.startsWith(PREVIEW_PREFIX)) {
    const route = resolveRoute(pathname.slice(PREVIEW_PREFIX.length))
    if (!route) {
      send(response, 404, "application/json; charset=utf-8", JSON.stringify({ error: "Unknown template" }))
      return
    }
    const { subject } = await render(route.template.id, route.variation.id)
    const body: PreviewSummary = {
      ...summarize(route.template),
      variation: { id: route.variation.id, name: route.variation.name },
      subject
    }
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(body))
    return
  }

  const route = resolveRoute(pathname.slice(RAW_PREFIX.length))
  if (!route) {
    send(response, 404, "text/plain; charset=utf-8", "Unknown template")
    return
  }
  const { html } = await render(route.template.id, route.variation.id)
  send(
    response,
    200,
    "text/html; charset=utf-8",
    route.template.type === "printout" ? wrapPrintout(route.template, html) : html
  )
}

/**
 * Serves the rendered Liquid the React viewer reads. This has to live in the dev server process
 * rather than the browser because liquidjs renders from the template files on disk.
 */
export function previewApi(): Plugin {
  return {
    name: "fc-templates-preview-api",
    configureServer(server) {
      // Registered here so it runs ahead of Vite's SPA fallback, which would otherwise answer
      // /raw/... with index.html.
      server.middlewares.use((request, response, next) => {
        const { pathname } = new URL(request.url ?? "/", "http://127.0.0.1")
        if (!ownsRoute(pathname)) {
          next()
          return
        }
        void respond(pathname, response).catch((error: unknown) => {
          const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
          send(response, 500, "text/html; charset=utf-8", `<pre>${escapeHtml(message)}</pre>`)
        })
      })
    }
  }
}

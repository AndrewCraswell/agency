import type { PreviewSummary, TemplateSummary } from "../preview/contract.ts"

/*
 * The endpoints are served by the Vite dev server middleware in src/preview, so the shapes are
 * guaranteed by the contract module both sides import rather than by a runtime schema.
 */
async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status}`)
  }
  return (await response.json()) as T
}

export function fetchTemplates(): Promise<TemplateSummary[]> {
  return getJson<TemplateSummary[]>("/api/templates")
}

export function fetchPreview(templateId: string, variationId: string): Promise<PreviewSummary> {
  return getJson<PreviewSummary>(`/api/preview/${templateId}/${variationId}`)
}

/** The rendered template itself, which the viewer shows in an iframe. */
export function rawUrl(templateId: string, variationId: string, highlightVariables = false): string {
  const path = `/raw/${templateId}/${variationId}`
  return highlightVariables ? `${path}?variables=1` : path
}

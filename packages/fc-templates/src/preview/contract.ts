import type { Template, TemplateGroup } from "../types.ts"

/** A variation reduced to what the viewer needs to label and address it. */
export type VariationSummary = {
  id: string
  name: string
}

/** One entry of `GET /api/templates`: enough to list and filter without rendering anything. */
export type TemplateSummary = {
  id: string
  name: string
  group: TemplateGroup
  type: Template["type"]
  /** Pre-lowercased haystack the index filters against. */
  search: string
  /** Where a human goes to paste this template in. */
  adminUrl: string
  variations: [VariationSummary, ...VariationSummary[]]
}

/** `GET /api/preview/:templateId/:variationId`: the summary plus what only a render can tell us. */
export type PreviewSummary = TemplateSummary & {
  variation: VariationSummary
  /** The rendered email subject. Empty for printouts, which have none. */
  subject: string
}

import type { Change } from "diff"
import { diffWords, diffWordsWithSpace } from "diff"
import type { ArticleRevisionOrigin } from "../persistence/article-repository.server"

/** The fields a version stores, flattened to text so the browser can compare them without parsing HTML. */
export type VersionContent = {
  title: string
  excerpt: string
  tags: string[]
  bodyText: string
  author: string
  handle: string
  seoTitle: string
  seoDescription: string
}

export type ArticleVersion = VersionContent & {
  revisionId: string
  revisionNumber: number
  origin: ArticleRevisionOrigin
  createdAt: string
  isCurrent: boolean
  isPublished: boolean
  hasPublicationHistory: boolean
}

export type DiffChange = "added" | "removed" | "unchanged"
export type DiffPart = { value: string; change: DiffChange }
export type FieldDiff = { field: string; parts: DiffPart[]; hasChanges: boolean }

function toChange(change: Change): DiffChange {
  if (change.added === true) {
    return "added"
  }
  if (change.removed === true) {
    return "removed"
  }
  return "unchanged"
}

function toFieldDiff(field: string, changes: Change[]): FieldDiff {
  const parts = changes.map((change) => ({ value: change.value, change: toChange(change) }))
  return { field, parts, hasChanges: parts.some((part) => part.change !== "unchanged") }
}

/**
 * Compares two versions field by field.
 * Pass the working copy first and the older version second, so additions read as what a restore brings back.
 */
export function diffVersions(before: VersionContent, after: VersionContent): FieldDiff[] {
  return [
    toFieldDiff("Title", diffWords(before.title, after.title)),
    toFieldDiff("Excerpt", diffWords(before.excerpt, after.excerpt)),
    toFieldDiff("Tags", diffWords(before.tags.join(", "), after.tags.join(", "))),
    toFieldDiff("Content", diffWordsWithSpace(before.bodyText, after.bodyText)),
    toFieldDiff("Author", diffWords(before.author, after.author)),
    toFieldDiff("URL handle", diffWords(before.handle, after.handle)),
    toFieldDiff("Search engine title", diffWords(before.seoTitle, after.seoTitle)),
    toFieldDiff("Search engine description", diffWords(before.seoDescription, after.seoDescription))
  ]
}

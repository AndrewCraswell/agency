import { useNavigate } from "react-router"
import type { ArticleSummary } from "../persistence/blog-workspace-repository.server"

export type ArticlesPageProps = {
  articles: ArticleSummary[]
}

type LinkType = keyof ArticleSummary["linkTypeCounts"]

type StatusTone = "neutral" | "info" | "caution" | "success" | "warning" | "critical"

const STATUS_LABELS: Record<ArticleSummary["status"], string> = {
  draft: "Draft",
  needs_review: "Needs review",
  ready_to_publish: "Ready to publish",
  published: "Published",
  needs_attention: "Needs attention",
  failed: "Failed"
}

const STATUS_TONES: Record<ArticleSummary["status"], StatusTone> = {
  draft: "neutral",
  needs_review: "caution",
  ready_to_publish: "info",
  published: "success",
  needs_attention: "warning",
  failed: "critical"
}

// Articles reuse the plan board icon set so a link chip reads as the same storefront resource type everywhere.
const LINK_TYPE_ICONS = {
  product: "product",
  collection: "collection",
  blog: "blog",
  article: "blog",
  page: "page"
} as const

const LINK_TYPE_LABELS: Record<LinkType, { singular: string; plural: string }> = {
  product: { singular: "product", plural: "products" },
  collection: { singular: "collection", plural: "collections" },
  blog: { singular: "blog", plural: "blogs" },
  article: { singular: "article", plural: "articles" },
  page: { singular: "page", plural: "pages" }
}

const LINK_TYPE_ORDER: LinkType[] = ["product", "collection", "blog", "article", "page"]

function formatUpdatedAt(updatedAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(updatedAt))
}

function formatLinkCount(linkType: LinkType, count: number) {
  const { singular, plural } = LINK_TYPE_LABELS[linkType]
  return `${count} ${count === 1 ? singular : plural}`
}

function LinkTypeCounts({ counts }: { counts: ArticleSummary["linkTypeCounts"] }) {
  const linkTypes = LINK_TYPE_ORDER.filter((linkType) => counts[linkType] > 0)

  if (linkTypes.length === 0) {
    return <s-text color="subdued">No link suggestions yet</s-text>
  }

  return (
    <fieldset aria-label="Link suggestions by type" style={{ border: 0, margin: 0, padding: 0 }}>
      <s-stack direction="inline" gap="small">
        {linkTypes.map((linkType) => (
          <s-chip key={linkType}>
            <s-icon slot="graphic" type={LINK_TYPE_ICONS[linkType]} />
            {formatLinkCount(linkType, counts[linkType])}
          </s-chip>
        ))}
      </s-stack>
    </fieldset>
  )
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  const navigate = useNavigate()

  return (
    <s-clickable
      accessibilityLabel={`Open ${article.title}`}
      background="base"
      border="base"
      borderRadius="base"
      padding="base"
      onClick={() => navigate(`/app/articles/${article.articleId}`)}
    >
      <s-stack direction="block" gap="small-100">
        <s-stack direction="inline" gap="base" alignItems="start" justifyContent="space-between">
          <s-heading>{article.title}</s-heading>
          <s-badge tone={STATUS_TONES[article.status]}>{STATUS_LABELS[article.status]}</s-badge>
        </s-stack>
        <s-paragraph>{article.excerpt}</s-paragraph>
        <s-text color="subdued">Updated {formatUpdatedAt(article.updatedAt)}</s-text>
        <LinkTypeCounts counts={article.linkTypeCounts} />
      </s-stack>
    </s-clickable>
  )
}

export function ArticlesPage({ articles }: ArticlesPageProps) {
  return (
    <s-page heading="Articles">
      <s-section heading="Your articles">
        {articles.length === 0 ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>No articles are ready for review. Generate a draft from an idea to start one.</s-paragraph>
            <s-link href="/app/plan">Open plan</s-link>
          </s-stack>
        ) : (
          <s-stack direction="block" gap="base">
            {articles.map((article) => (
              <ArticleCard article={article} key={article.articleId} />
            ))}
          </s-stack>
        )}
      </s-section>
    </s-page>
  )
}

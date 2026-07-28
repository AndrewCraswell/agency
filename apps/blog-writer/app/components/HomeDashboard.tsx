import { useNavigate } from "react-router"
import type { HomeArticle, HomeOverview } from "../persistence/home-overview-repository.server"
import "./HomeDashboard.css"

export type HomeDashboardProps = {
  syncStatus: "pending" | "syncing" | "ready" | "failed"
  activeResourceCount: number
  lastSynchronizedAt: string | null
  subscribedSourceCount: number
  overview: HomeOverview
}

type AttentionTone = "critical" | "warning" | "caution" | "info"

/** One thing a merchant can act on, already carrying the words Home will show and the page that owns the fix. */
type AttentionItem = {
  id: string
  badge: string
  tone: AttentionTone
  title: string
  detail: string
  href: string
}

/** Home shows the worst few and counts the rest, because a list this long stops being a priority. */
const ATTENTION_LIMIT = 5
const DECISION_LIMIT = 3
const PUBLISHED_LIMIT = 3

const JOB_LABELS: Record<string, string> = {
  onboarding: "Setup",
  catalog_sync: "Store sync",
  content_sync: "Store sync",
  indexing: "Store indexing",
  reconciliation: "Store sync",
  idea_generation: "Idea generation",
  draft_generation: "Draft generation",
  crosslinks: "Storefront link suggestions",
  further_reading: "Further reading suggestions"
}

const JOB_DESTINATIONS: Record<string, string> = {
  idea_generation: "/app/plan",
  draft_generation: "/app/plan",
  crosslinks: "/app/articles",
  further_reading: "/app/articles"
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`
}

function formatDay(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(year!, month! - 1, day!)
  )
}

const RELATIVE_UNITS = [
  { unit: "minute", milliseconds: 60_000 },
  { unit: "hour", milliseconds: 3_600_000 },
  { unit: "day", milliseconds: 86_400_000 }
] as const

/** "Synced 3 hours ago" answers "is this current?" faster than a timestamp does. */
function formatRelative(value: string) {
  const elapsed = Date.now() - new Date(value).getTime()
  if (elapsed < RELATIVE_UNITS[0].milliseconds) {
    return "just now"
  }
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const match = RELATIVE_UNITS.findLast(({ milliseconds }) => elapsed >= milliseconds) ?? RELATIVE_UNITS[0]
  return format.format(-Math.floor(elapsed / match.milliseconds), match.unit)
}

/** Settings owns the exact timestamps and the per-type breakdown, so Home answers only "is this current?". */
function getStoreStatus(syncStatus: HomeDashboardProps["syncStatus"], lastSynchronizedAt: string | null) {
  if (syncStatus === "syncing") {
    return { tone: "info", label: "Syncing", detail: "New content will show up here when it finishes." } as const
  }
  if (syncStatus === "failed") {
    return { tone: "critical", label: "Sync failed", detail: "Start the sync again from Settings." } as const
  }
  if (syncStatus === "ready" && lastSynchronizedAt !== null) {
    return { tone: "success", label: "Synced", detail: `Last synced ${formatRelative(lastSynchronizedAt)}` } as const
  }
  return { tone: "neutral", label: "Not synced", detail: "Store content hasn't been synced yet." } as const
}

function getProposedLinkCount(article: HomeArticle) {
  return article.proposedCrosslinkCount + article.proposedFurtherReadingCount
}

/**
 * Home shows one card per article, so an article that is behind on several counts is listed once under its
 * most urgent reason. Proposed links are deliberately absent: the decisions section below covers them in detail.
 */
function buildArticleAttention(articles: HomeArticle[]) {
  const items: AttentionItem[] = []
  const listed = new Set<string>()

  function add(article: HomeArticle, item: Omit<AttentionItem, "href" | "title">) {
    if (listed.has(article.articleId)) {
      return
    }
    listed.add(article.articleId)
    items.push({ ...item, title: article.title, href: `/app/articles/${article.articleId}` })
  }

  for (const article of articles.filter(({ status }) => status === "failed")) {
    add(article, {
      id: `article-failed-${article.articleId}`,
      badge: "Failed",
      tone: "critical",
      detail: "Writing this article didn't finish. Open it to try again."
    })
  }

  for (const article of articles.filter(({ status }) => status === "needs_attention")) {
    add(article, {
      id: `article-attention-${article.articleId}`,
      badge: "Needs attention",
      tone: "warning",
      detail:
        article.staleLinkCount > 0
          ? `Something this article links to has changed, so ${countLabel(article.staleLinkCount, "link is", "links are")} out of date.`
          : "Check this article before it goes out."
    })
  }

  for (const article of articles.filter(({ status }) => status === "needs_review")) {
    add(article, {
      id: `article-review-${article.articleId}`,
      badge: "Needs review",
      tone: "caution",
      detail: "A new draft is ready for you to read."
    })
  }

  for (const article of articles.filter(({ hasUnpublishedChanges }) => hasUnpublishedChanges)) {
    add(article, {
      id: `article-unpublished-${article.articleId}`,
      badge: "Not published",
      tone: "info",
      detail: "Readers still see the version you published last."
    })
  }

  return items
}

function buildAttentionItems({ syncStatus, lastSynchronizedAt, overview }: HomeDashboardProps) {
  const items: AttentionItem[] = []

  for (const job of overview.failedJobs) {
    items.push({
      id: `job-${job.jobId}`,
      badge: "Failed",
      tone: "critical",
      title: `${JOB_LABELS[job.jobType] ?? "A background task"} didn't finish`,
      detail:
        job.lastErrorCode === null
          ? `It stopped ${formatRelative(job.failedAt)}. Start it again.`
          : `It stopped ${formatRelative(job.failedAt)} with the error ${job.lastErrorCode}. Start it again.`,
      href: JOB_DESTINATIONS[job.jobType] ?? "/app/settings"
    })
  }

  if (syncStatus === "failed") {
    items.push({
      id: "sync-failed",
      badge: "Failed",
      tone: "critical",
      title: "Store sync didn't finish",
      detail: "Ideas and links need your store content. Sync it again from Settings.",
      href: "/app/settings"
    })
  }

  items.push(...buildArticleAttention(overview.articles))

  if (overview.ideasToReview > 0) {
    items.push({
      id: "ideas-to-review",
      badge: "To review",
      tone: "info",
      title: `${countLabel(overview.ideasToReview, "idea is", "ideas are")} waiting for your review`,
      detail: "Approve the ones worth writing and dismiss the rest.",
      href: "/app/plan"
    })
  }

  if (syncStatus === "pending" && lastSynchronizedAt === null) {
    items.push({
      id: "sync-pending",
      badge: "To do",
      tone: "caution",
      title: "Sync your store content",
      detail: "Ideas and links come from your products, collections, and pages.",
      href: "/app/settings"
    })
  }

  return items
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const navigate = useNavigate()

  return (
    <s-clickable
      accessibilityLabel={`${item.title}. ${item.detail}`}
      background="base"
      border="base"
      borderRadius="base"
      padding="base"
      onClick={() => navigate(item.href)}
    >
      <s-stack direction="block" gap="small-100">
        <s-stack direction="inline" gap="base" alignItems="start" justifyContent="space-between">
          <s-heading>{item.title}</s-heading>
          <s-badge tone={item.tone}>{item.badge}</s-badge>
        </s-stack>
        <s-paragraph>{item.detail}</s-paragraph>
      </s-stack>
    </s-clickable>
  )
}

function PipelineStages({ overview }: { overview: HomeOverview }) {
  const navigate = useNavigate()
  const stages = [
    { label: "Ideas to review", count: overview.ideasToReview, href: "/app/plan" },
    { label: "Scheduled", count: overview.scheduledIdeaCount, href: "/app/plan" },
    { label: "Writing", count: overview.generatingCount, href: "/app/plan" },
    {
      label: "In review",
      count: overview.articleCounts.draft + overview.articleCounts.needs_review,
      href: "/app/articles"
    },
    { label: "Ready to publish", count: overview.articleCounts.ready_to_publish, href: "/app/articles" },
    { label: "Published", count: overview.articleCounts.published, href: "/app/articles" }
  ]

  return (
    <div className="home-pipeline">
      {stages.map((stage) => (
        <s-clickable
          key={stage.label}
          accessibilityLabel={`${stage.label}, ${stage.count}`}
          background="base"
          border="base"
          borderRadius="base"
          padding="small-200"
          onClick={() => navigate(stage.href)}
        >
          <div className="home-stat">
            <span className="home-stat__value">{stage.count}</span>
            <s-text color="subdued">{stage.label}</s-text>
          </div>
        </s-clickable>
      ))}
    </div>
  )
}

function SetupChecklist({ syncStatus, subscribedSourceCount }: HomeDashboardProps) {
  const steps = [
    {
      label: "Sync your store content",
      detail: "Products, collections, blogs, and pages give every draft something true to say.",
      isDone: syncStatus === "ready",
      href: "/app/settings"
    },
    {
      label: "Add the sources you trust",
      detail: "Subscribed publications give drafts something to cite.",
      isDone: subscribedSourceCount > 0,
      href: "/app/settings"
    },
    {
      label: "Generate your first ideas",
      detail: "Keep the ones worth writing, then give them a date.",
      isDone: false,
      href: "/app/plan"
    }
  ]

  return (
    <s-section heading="Get set up">
      <s-stack direction="block" gap="base">
        <s-paragraph>Three steps to your first draft.</s-paragraph>
        {steps.map((step) => (
          <s-stack key={step.label} direction="block" gap="small-500">
            <s-stack direction="inline" gap="small" alignItems="center">
              <s-link href={step.href}>{step.label}</s-link>
              {step.isDone ? <s-badge tone="success">Done</s-badge> : null}
            </s-stack>
            <s-text color="subdued">{step.detail}</s-text>
          </s-stack>
        ))}
      </s-stack>
    </s-section>
  )
}

function ThisWeek({ overview }: { overview: HomeOverview }) {
  return (
    <s-section heading="This week">
      <s-stack direction="block" gap="base">
        {overview.scheduledIdeas.length === 0 ? (
          <s-paragraph>Nothing is scheduled for the next seven days.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {overview.scheduledIdeas.map((idea) => (
              <s-stack key={idea.ideaId} direction="inline" gap="base" justifyContent="space-between">
                <s-text>{idea.title}</s-text>
                <s-text color="subdued">{formatDay(idea.scheduledFor)}</s-text>
              </s-stack>
            ))}
          </s-stack>
        )}
        {overview.unscheduledIdeaCount > 0 ? (
          <s-paragraph>
            {countLabel(overview.unscheduledIdeaCount, "approved idea has", "approved ideas have")} no date yet.
          </s-paragraph>
        ) : null}
        <s-link href="/app/plan">Open plan</s-link>
      </s-stack>
    </s-section>
  )
}

function PublishedWork({ overview }: { overview: HomeOverview }) {
  const published = overview.articles
    .filter((article): article is HomeArticle & { publishedAt: string } => article.publishedAt !== null)
    .sort((first, second) => second.publishedAt.localeCompare(first.publishedAt))
    .slice(0, PUBLISHED_LIMIT)

  return (
    <s-section heading="Published work">
      <s-stack direction="block" gap="base">
        {published.length === 0 ? (
          <s-paragraph>Nothing is on your online store yet.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            {published.map((article) => (
              <s-stack key={article.articleId} direction="block" gap="small-500">
                <s-link href={`/app/articles/${article.articleId}`}>{article.title}</s-link>
                <s-text color="subdued">
                  {article.hasUnpublishedChanges
                    ? `Published ${formatRelative(article.publishedAt)}, with newer changes saved`
                    : `Published ${formatRelative(article.publishedAt)}`}
                </s-text>
              </s-stack>
            ))}
          </s-stack>
        )}
      </s-stack>
    </s-section>
  )
}

function StoreContent({
  syncStatus,
  activeResourceCount,
  lastSynchronizedAt,
  subscribedSourceCount
}: HomeDashboardProps) {
  const status = getStoreStatus(syncStatus, lastSynchronizedAt)

  return (
    <s-section heading="Store content">
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-100" alignItems="center">
          <s-badge tone={status.tone}>{status.label}</s-badge>
          <s-text color="subdued">{status.detail}</s-text>
        </s-stack>
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat__value">{activeResourceCount}</span>
            <s-text color="subdued">Indexed resources</s-text>
          </div>
          <div className="home-stat">
            <span className="home-stat__value">{subscribedSourceCount}</span>
            <s-text color="subdued">Subscribed sources</s-text>
          </div>
        </div>
        <s-link href="/app/settings">Manage store content and sources</s-link>
      </s-stack>
    </s-section>
  )
}

export function HomeDashboard(props: HomeDashboardProps) {
  const { overview } = props
  const attentionItems = buildAttentionItems(props)
  const visibleAttentionItems = attentionItems.slice(0, ATTENTION_LIMIT)
  const hiddenAttentionCount = attentionItems.length - visibleAttentionItems.length
  const decisionArticles = overview.articles
    .filter((article) => getProposedLinkCount(article) > 0)
    .slice(0, DECISION_LIMIT)
  const hasEditorialWork =
    overview.articles.length > 0 ||
    overview.ideasToReview > 0 ||
    overview.scheduledIdeaCount > 0 ||
    overview.unscheduledIdeaCount > 0

  return (
    <s-page heading="Home">
      {hasEditorialWork ? (
        <>
          <s-section heading="Needs attention">
            <s-stack direction="block" gap="base">
              {visibleAttentionItems.length === 0 ? (
                <s-paragraph>Nothing needs you right now. Your published work is up to date.</s-paragraph>
              ) : (
                visibleAttentionItems.map((item) => <AttentionCard item={item} key={item.id} />)
              )}
              {hiddenAttentionCount > 0 ? (
                <s-paragraph>
                  Open Articles to see {hiddenAttentionCount} more{" "}
                  {hiddenAttentionCount === 1 ? "item that needs" : "items that need"} a look.
                </s-paragraph>
              ) : null}
            </s-stack>
          </s-section>

          <s-section heading="Your pipeline">
            <s-stack direction="block" gap="base">
              <PipelineStages overview={overview} />
              <s-text color="subdued">Select any stage to open it.</s-text>
            </s-stack>
          </s-section>

          {decisionArticles.length > 0 ? (
            <s-section heading="Links waiting for a decision">
              <s-stack direction="block" gap="base">
                {decisionArticles.map((article) => (
                  <s-stack key={article.articleId} direction="block" gap="small-500">
                    <s-link href={`/app/articles/${article.articleId}`}>{article.title}</s-link>
                    <div className="home-chips">
                      {article.proposedCrosslinkCount > 0 ? (
                        <s-chip>
                          <s-icon slot="graphic" type="product" />
                          {countLabel(article.proposedCrosslinkCount, "storefront link", "storefront links")}
                        </s-chip>
                      ) : null}
                      {article.proposedFurtherReadingCount > 0 ? (
                        <s-chip>
                          <s-icon slot="graphic" type="blog" />
                          {countLabel(article.proposedFurtherReadingCount, "further reading", "further reading")}
                        </s-chip>
                      ) : null}
                    </div>
                  </s-stack>
                ))}
              </s-stack>
            </s-section>
          ) : null}
        </>
      ) : (
        <SetupChecklist {...props} />
      )}

      {/* The aside carries the narrow, glanceable panels so the main column stays a single stream of work. */}
      <s-box slot="aside">
        <s-stack direction="block" gap="base">
          <StoreContent {...props} />
          {hasEditorialWork ? (
            <>
              <ThisWeek overview={overview} />
              <PublishedWork overview={overview} />
            </>
          ) : null}
        </s-stack>
      </s-box>
    </s-page>
  )
}

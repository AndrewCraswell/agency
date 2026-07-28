import { Fragment, useState } from "react"
import { useNavigation } from "react-router"
import type { KeywordImportOverview, KeywordImportSummary } from "../persistence/keyword-repository.server"
import type { ShopifyResourceCounts } from "../persistence/shopify-sync-repository.server"
import type { SourceSettings } from "../persistence/source-settings-repository.server"
import type { ContentDrift } from "../shopify-sync/fingerprint"
import type { ActionResult } from "./WorkflowForm"
import { WorkflowForm } from "./WorkflowForm"

type KeywordImportDomainResult = KeywordImportSummary["domains"][number]

export type SettingsPageProps = {
  syncStatus: "pending" | "syncing" | "ready" | "failed"
  activeResourceCount: number
  activeResourceCounts: ShopifyResourceCounts
  /** How much of the synced content has been prepared for search, which lands some minutes after the sync does. */
  embeddedResourceCount: number
  /**
   * Whether the store itself still matches what was copied across, measured against Shopify on this load.
   *
   * The last sync finishing says nothing about whether the merchant has edited a product since. Without this the
   * page can only report its own history, which is how a store that changed an hour ago goes on calling itself up to
   * date until somebody happens to press the button.
   */
  contentDrift: ContentDrift
  lastSynchronizedAt: string | null
  brandBrief: SourceSettings["brandBrief"]
  competitorDomains: SourceSettings["competitorDomains"]
  subscribedBlogs: SourceSettings["subscribedBlogs"]
  keywordImport: KeywordImportOverview
  /** The country and language pairs the keyword provider will measure. Empty when it could not be asked. */
  supportedMarkets: { countryCode: string; languageCode: string; locationName: string }[]
  actionResult: ActionResult
}

const countFormat = new Intl.NumberFormat()
const timestampFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })
const languageNames = new Intl.DisplayNames(undefined, { type: "language" })

function getActionMessage(actionResult: ActionResult) {
  if (actionResult === null) {
    return null
  }
  if (actionResult.error === "invalidCompetitorDomain") {
    return "Enter a valid competitor domain, such as example.com."
  }
  if (actionResult.error === "invalidBlogAddress") {
    return "Enter a valid blog address, such as example.com/blog."
  }
  if (actionResult.error === "blogUnreachable") {
    return "We couldn't open that address. Check the link and try again."
  }
  if (actionResult.error === "blogHasNoArticles") {
    return "We couldn't find any articles there. Paste the link to the page that lists the blog's posts, not a single post."
  }
  if (actionResult.error === "ownBlogAddress") {
    return "That blog belongs to your store. Follow blogs you don't own."
  }
  if (actionResult.error === "invalidBrandBrief") {
    return "Shorten the brand brief to 2,000 characters or fewer."
  }
  if (actionResult.error === "keywordMarketUnresolved") {
    return "Sync store content first so we can tell which country and language to measure search in."
  }
  if (actionResult.error === "unsupportedKeywordMarket") {
    return "Choose a market from the list. Those are the ones search can be measured in."
  }
  if (!actionResult.ok) {
    return actionResult.intent === "sync"
      ? "That sync didn't finish. Try again."
      : "That action didn't finish. Try again."
  }

  if (actionResult.intent === "importKeywords") {
    if (actionResult.keywordImportOutcome !== "current") {
      return "Keyword data collected."
    }
    // A forced request inside the floor is answered with the collection already on file, which is the data the
    // merchant asked for. Naming the throttle would describe a mechanism they cannot act on.
    return actionResult.keywordImportForced === true
      ? "Keyword data collected."
      : "Keyword data has been updated. We automatically collect it each month."
  }

  const messages: Record<string, string> = {
    sync: "Store content is up to date.",
    setBrandBrief: "Brand brief saved.",
    addCompetitorDomain: "Competitor added.",
    removeCompetitorDomain: "Competitor removed.",
    subscribeToBlog: "Blog subscribed.",
    unsubscribeFromBlog: "Blog unsubscribed.",
    setKeywordMarket: "Search market saved."
  }
  return messages[actionResult.intent] ?? "Action completed."
}

/**
 * Whether a result reads as good news, bad news, or merely news.
 *
 * A refresh that was declined because the data is already current is not a failure, so it must not borrow the tone of
 * one. The merchant asked for current data and has it.
 */
function getActionTone(actionResult: NonNullable<ActionResult>) {
  if (!actionResult.ok) {
    return "critical" as const
  }
  if (
    actionResult.intent === "importKeywords" &&
    actionResult.keywordImportOutcome === "current" &&
    actionResult.keywordImportForced !== true
  ) {
    return "info" as const
  }
  return "success" as const
}

/**
 * What the page is entitled to claim about the store's content.
 *
 * The order matters. A run in flight or a run that failed is a fact about the app and comes first, because there is
 * no point comparing against a snapshot that is being replaced or was never finished. After that the claim belongs to
 * the store rather than to the app: it is only up to date if the content still matches, and when Shopify could not be
 * asked the badge reports that a sync happened without pretending to know what has happened since.
 */
function getSyncBadge(syncStatus: SettingsPageProps["syncStatus"], contentDrift: ContentDrift, isBusy: boolean) {
  if (isBusy || syncStatus === "syncing") {
    return { tone: "info" as const, label: "Syncing" }
  }
  if (syncStatus === "failed") {
    return { tone: "critical" as const, label: "Sync failed" }
  }
  if (syncStatus !== "ready") {
    return { tone: "neutral" as const, label: "Not synced" }
  }
  if (contentDrift === "changed") {
    return { tone: "warning" as const, label: "Needs updating" }
  }
  if (contentDrift === "unknown") {
    return { tone: "neutral" as const, label: "Synced" }
  }
  return { tone: "success" as const, label: "Up to date" }
}

function formatTimestamp(value: string) {
  return timestampFormat.format(new Date(value))
}

function formatLastSync(value: string | null) {
  if (value === null) {
    return "Never synced"
  }
  return `Last synced ${formatTimestamp(value)}`
}

/**
 * How far the preparation behind a sync has got, said only once there is content for it to be behind.
 *
 * Copying a store's text across takes seconds and preparing it for search takes minutes, so a merchant who is told
 * only that the sync finished will go and use a feature that cannot answer them yet. Naming the gap is what makes the
 * wait legible instead of looking like a broken page.
 */
function formatReadiness(activeResourceCount: number, embeddedResourceCount: number) {
  if (activeResourceCount === 0) {
    return null
  }
  if (embeddedResourceCount === 0) {
    return "Preparing your content for search. Store-specific ideas and links wait until this finishes."
  }
  if (embeddedResourceCount < activeResourceCount) {
    return `${countFormat.format(embeddedResourceCount)} of ${countFormat.format(activeResourceCount)} items are ready to use. We're still preparing the rest.`
  }
  return "All of your content is ready to use."
}

function formatMarket(market: KeywordImportOverview["market"]) {
  if (market === null) {
    return "Not resolved yet"
  }
  return `${market.locationName}, ${languageNames.of(market.languageCode) ?? market.languageCode}`
}

function describeDomainResult(domain: KeywordImportDomainResult) {
  // A domain we never reached and a domain that genuinely has nothing are different facts, and reporting both as no
  // data sends a merchant looking for a problem with their competitor instead of with the collection.
  if (domain.status === "failed") {
    return domain.errorCode === null ? "Not collected" : `Not collected (${domain.errorCode})`
  }
  if (domain.rowCount === 0) {
    return "No keywords found"
  }
  if (domain.availableRowCount !== null && domain.availableRowCount > domain.rowCount) {
    return `${countFormat.format(domain.rowCount)} of ${countFormat.format(domain.availableRowCount)} keywords`
  }
  return `${countFormat.format(domain.rowCount)} keywords`
}

type Row = { key: string; content: React.ReactNode }

/**
 * A bordered list of rows with hairlines between them.
 *
 * Settings pages are mostly stated facts, and a run of bare paragraphs gives a merchant no way to tell a label from a
 * value or one record from the next. Enclosing the facts and ruling between them is what makes them scannable.
 */
function RowList({ rows }: { rows: Row[] }) {
  return (
    <s-box border="base" borderRadius="base">
      {rows.map((row, index) => (
        <Fragment key={row.key}>
          {index === 0 ? null : (
            <s-box paddingInline="base">
              <s-divider />
            </s-box>
          )}
          <s-box paddingInline="base" paddingBlock="small">
            {row.content}
          </s-box>
        </Fragment>
      ))}
    </s-box>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
      <s-text color="subdued">{label}</s-text>
      <s-text>{value}</s-text>
    </s-grid>
  )
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <s-box border="base" borderRadius="base" padding="base">
      <s-text color="subdued">{children}</s-text>
    </s-box>
  )
}

/**
 * The banner for a section, shown only when the last action belonged to that section.
 *
 * Results are announced where the merchant was working rather than in one shared strip at the top, because a settings
 * page has five independent things to change and a message detached from its control says nothing about which one
 * moved.
 *
 * The message is withdrawn while the section's own control is running. It describes a run that has been superseded, and
 * leaving it under a spinner invites a merchant to read the old outcome as the new one.
 */
function ActionBanner({
  actionResult,
  message,
  intents,
  runningIntent
}: {
  actionResult: ActionResult
  message: string | null
  intents: string[]
  runningIntent: string | null
}) {
  if (actionResult === null || message === null || !intents.includes(actionResult.intent)) {
    return null
  }
  if (runningIntent !== null && intents.includes(runningIntent)) {
    return null
  }
  return <s-banner tone={getActionTone(actionResult)}>{message}</s-banner>
}

/**
 * The country and language search is measured in.
 *
 * Both fields open on the market already on file, which for most stores is the one read off the Shopify billing
 * address, so a merchant who only came to look leaves it as it was found.
 *
 * The language follows the country rather than standing beside it as an equal choice. The provider measures a fixed
 * set of pairs, and offering a language it does not read in the chosen country would let a merchant save a market that
 * every collection then refuses.
 */
function MarketPicker({
  markets,
  market,
  isBusy,
  runningIntent
}: {
  markets: SettingsPageProps["supportedMarkets"]
  market: KeywordImportOverview["market"]
  isBusy: boolean
  runningIntent: string | null
}) {
  const [countryCode, setCountryCode] = useState(market?.countryCode ?? "")
  const [languageCode, setLanguageCode] = useState(market?.languageCode ?? "")

  const countries = [...new Map(markets.map((entry) => [entry.countryCode, entry.locationName])).entries()]
  const languages = markets.filter((entry) => entry.countryCode === countryCode)
  // A country is not always read in the language that was on file, so a change of country falls back to the first
  // language measured there instead of holding a pair the provider would reject.
  const selectedLanguage =
    languages.find((entry) => entry.languageCode === languageCode)?.languageCode ?? languages[0]?.languageCode ?? ""

  return (
    <WorkflowForm intent="setKeywordMarket" isBusy={isBusy}>
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          <s-select
            label="Search market"
            name="marketCountryCode"
            value={countryCode}
            onChange={(event) => setCountryCode(event.currentTarget.value)}
            details="Where your customers search, which is not always where the store is billed."
          >
            {countryCode === "" ? <s-option value="">Not resolved yet</s-option> : null}
            {countries.map(([code, locationName]) => (
              <s-option key={code} value={code}>
                {locationName}
              </s-option>
            ))}
          </s-select>
          <s-select
            label="Search language"
            name="marketLanguageCode"
            value={selectedLanguage}
            onChange={(event) => setLanguageCode(event.currentTarget.value)}
            details="Only the languages measured in that country."
          >
            {selectedLanguage === "" ? <s-option value="">Not resolved yet</s-option> : null}
            {languages.map((entry) => (
              <s-option key={entry.languageCode} value={entry.languageCode}>
                {languageNames.of(entry.languageCode) ?? entry.languageCode}
              </s-option>
            ))}
          </s-select>
        </s-grid>
        <s-stack direction="inline" justifyContent="end">
          <s-button type="submit" loading={runningIntent === "setKeywordMarket" || undefined}>
            Save market
          </s-button>
        </s-stack>
      </s-stack>
    </WorkflowForm>
  )
}

export function SettingsPage({
  syncStatus,
  activeResourceCount,
  activeResourceCounts,
  embeddedResourceCount,
  contentDrift,
  lastSynchronizedAt,
  brandBrief,
  competitorDomains,
  subscribedBlogs,
  keywordImport,
  supportedMarkets,
  actionResult
}: SettingsPageProps) {
  const navigation = useNavigation()
  const isBusy = navigation.state !== "idle"
  const submittedIntent = navigation.formData?.get("intent")
  // Which control the merchant just pressed, and nothing while the page is idle. Progress belongs to the control that
  // started the work: a spinner on every button, or a sync badge reading "Syncing" because a market was saved,
  // describes work that is not happening.
  const runningIntent = isBusy && typeof submittedIntent === "string" ? submittedIntent : null
  const actionMessage = getActionMessage(actionResult)
  const syncBadge = getSyncBadge(syncStatus, contentDrift, runningIntent === "sync")
  const readiness = formatReadiness(activeResourceCount, embeddedResourceCount)
  const lastImport = keywordImport.lastImport

  const resourceRows: Row[] = [
    {
      key: "product",
      content: <DetailRow label="Products" value={countFormat.format(activeResourceCounts.product)} />
    },
    {
      key: "collection",
      content: <DetailRow label="Collections" value={countFormat.format(activeResourceCounts.collection)} />
    },
    { key: "blog", content: <DetailRow label="Blogs" value={countFormat.format(activeResourceCounts.blog)} /> },
    {
      key: "article",
      content: <DetailRow label="Articles" value={countFormat.format(activeResourceCounts.article)} />
    },
    { key: "page", content: <DetailRow label="Pages" value={countFormat.format(activeResourceCounts.page)} /> },
    {
      key: "total",
      content: (
        <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
          <s-text type="strong">Total synced</s-text>
          <s-text type="strong">{countFormat.format(activeResourceCount)}</s-text>
        </s-grid>
      )
    }
  ]

  // Offered only after a refresh has actually been declined, so the way to spend money out of cadence is discovered at
  // the moment a merchant has a reason to, rather than sitting next to the ordinary button inviting the click.
  const canForceCollection =
    actionResult?.intent === "importKeywords" &&
    actionResult.keywordImportOutcome === "current" &&
    actionResult.keywordImportForced !== true

  const keywordRows: Row[] = []
  if (lastImport !== null) {
    for (const domain of lastImport.domains) {
      keywordRows.push({
        key: domain.domain,
        content: (
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text>{domain.domain}</s-text>
              {domain.isOwnDomain ? <s-badge tone="info">Your store</s-badge> : null}
            </s-stack>
            <s-text color="subdued">{describeDomainResult(domain)}</s-text>
          </s-grid>
        )
      })
    }
  }

  return (
    <s-page heading="Settings">
      <s-section heading="Brand brief">
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            Describe what the store sells, who it sells to, and how it should sound. Every idea and draft is written
            against this brief, so keep it specific.
          </s-paragraph>
          <ActionBanner
            actionResult={actionResult}
            message={actionMessage}
            intents={["setBrandBrief"]}
            runningIntent={runningIntent}
          />
          <WorkflowForm intent="setBrandBrief" isBusy={isBusy}>
            <s-stack direction="block" gap="base">
              <s-text-area
                label="Brand brief"
                name="brandBrief"
                value={brandBrief}
                rows={5}
                details="For example: an independent snowboard shop serving riders from their first season to the backcountry."
              />
              <s-stack direction="inline" justifyContent="end">
                <s-button type="submit" variant="primary">
                  Save brand brief
                </s-button>
              </s-stack>
            </s-stack>
          </WorkflowForm>
        </s-stack>
      </s-section>

      <s-section heading="Store content">
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            Sync products, collections, blog posts, and pages before generating store-specific ideas and links.
          </s-paragraph>
          <ActionBanner
            actionResult={actionResult}
            message={actionMessage}
            intents={["sync"]}
            runningIntent={runningIntent}
          />
          {syncStatus === "failed" && actionResult?.intent !== "sync" && runningIntent !== "sync" ? (
            <s-banner tone="critical">{"The last sync didn't finish. Try again."}</s-banner>
          ) : null}
          {contentDrift === "changed" && syncStatus === "ready" && runningIntent !== "sync" ? (
            <s-banner tone="warning">
              Your store has changed since the last sync. Sync again so ideas and links use your current products and
              posts.
            </s-banner>
          ) : null}
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-badge tone={syncBadge.tone}>{syncBadge.label}</s-badge>
              <s-text color="subdued">{formatLastSync(lastSynchronizedAt)}</s-text>
            </s-stack>
            <WorkflowForm intent="sync" isBusy={isBusy}>
              <s-button type="submit" variant="primary" loading={runningIntent === "sync" || undefined}>
                Sync store content
              </s-button>
            </WorkflowForm>
          </s-grid>
          {readiness === null ? null : <s-text color="subdued">{readiness}</s-text>}
          <fieldset aria-label="Synced resources by type" style={{ border: 0, margin: 0, padding: 0 }}>
            <RowList rows={resourceRows} />
          </fieldset>
        </s-stack>
      </s-section>

      <s-section heading="Keyword data">
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            Collect what your store and your competitors already rank for. Everything on the Keywords page is measured
            from this data, so nothing is estimated on your behalf.
          </s-paragraph>
          <ActionBanner
            actionResult={actionResult}
            message={actionMessage}
            intents={["importKeywords", "setKeywordMarket"]}
            runningIntent={runningIntent}
          />
          {lastImport?.status === "partial" && runningIntent !== "importKeywords" ? (
            <s-banner tone="warning">
              {"The last collection didn't reach every domain. Collect again to fill in the ones marked not collected."}
            </s-banner>
          ) : null}
          {/* Two right-aligned buttons a row apart read as a pair, and the market form and the collection are not one:
              saving a market spends nothing and collecting spends money. The extra space keeps them apart. */}
          <s-box paddingBlockEnd="base">
            {supportedMarkets.length === 0 ? (
              <DetailRow label="Search market" value={formatMarket(keywordImport.market)} />
            ) : (
              <MarketPicker
                markets={supportedMarkets}
                market={keywordImport.market}
                isBusy={isBusy}
                runningIntent={runningIntent}
              />
            )}
          </s-box>
          {canForceCollection ? (
            <WorkflowForm intent="importKeywords" isBusy={isBusy} force>
              <s-button type="submit" loading={runningIntent === "importKeywords" || undefined}>
                Collect anyway
              </s-button>
            </WorkflowForm>
          ) : null}
          <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
            <s-text color="subdued">
              {lastImport === null ? "Never collected" : `Last collected ${formatTimestamp(lastImport.requestedAt)}`}
            </s-text>
            <WorkflowForm intent="importKeywords" isBusy={isBusy}>
              <s-button
                type="submit"
                variant="primary"
                loading={runningIntent === "importKeywords" || undefined}
                disabled={keywordImport.market === null || undefined}
              >
                Collect keyword data
              </s-button>
            </WorkflowForm>
          </s-grid>
          {keywordRows.length === 0 ? null : <RowList rows={keywordRows} />}
        </s-stack>
      </s-section>

      <s-section heading="Competitor domains">
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            Add the stores you compete with in search. We measure what they rank for, so this list decides how much of
            your market the keyword data covers.
          </s-paragraph>
          <ActionBanner
            actionResult={actionResult}
            message={actionMessage}
            intents={["addCompetitorDomain", "removeCompetitorDomain"]}
            runningIntent={runningIntent}
          />
          <WorkflowForm intent="addCompetitorDomain" isBusy={isBusy}>
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
              <s-text-field label="Competitor domain" name="competitorDomain" placeholder="example.com" />
              <s-button type="submit">Add competitor</s-button>
            </s-grid>
          </WorkflowForm>
          {competitorDomains.length === 0 ? (
            <EmptyRow>No competitor domains have been added.</EmptyRow>
          ) : (
            <RowList
              rows={competitorDomains.map((hostname) => ({
                key: hostname,
                content: (
                  <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                    <s-text>{hostname}</s-text>
                    <WorkflowForm
                      intent="removeCompetitorDomain"
                      identifier={{ name: "competitorDomain", value: hostname }}
                      isBusy={isBusy}
                    >
                      <s-button
                        type="submit"
                        variant="tertiary"
                        tone="critical"
                        icon="delete"
                        accessibilityLabel={`Remove ${hostname}`}
                      />
                    </WorkflowForm>
                  </s-grid>
                )
              }))}
            />
          )}
        </s-stack>
      </s-section>

      <s-section heading="Subscribed blogs">
        <s-stack direction="block" gap="small-200">
          <s-paragraph color="subdued">
            {
              "Follow the blogs you want used as sources for content research. We read them for what your market is already discussing. Paste the link to the page that lists a blog's posts, such as example.com/blog, and we'll check that articles can be read from it."
            }
          </s-paragraph>
          <ActionBanner
            actionResult={actionResult}
            message={actionMessage}
            intents={["subscribeToBlog", "unsubscribeFromBlog"]}
            runningIntent={runningIntent}
          />
          <WorkflowForm intent="subscribeToBlog" isBusy={isBusy}>
            <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
              <s-text-field label="Blog address" name="blogAddress" placeholder="example.com/blog" />
              <s-button type="submit">Subscribe</s-button>
            </s-grid>
          </WorkflowForm>
          {subscribedBlogs.length === 0 ? (
            <EmptyRow>No blogs have been added.</EmptyRow>
          ) : (
            <RowList
              rows={subscribedBlogs.map((blog) => {
                const blogName = blog.title ?? blog.hostname
                return {
                  key: blog.hostname,
                  content: (
                    <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
                      <s-stack direction="block" gap="small-500">
                        <s-link href={blog.url} target="_blank">
                          {blogName}
                        </s-link>
                        {blog.title === null ? null : <s-text color="subdued">{blog.hostname}</s-text>}
                        <s-text color="subdued">{formatLastSync(blog.lastSynchronizedAt)}</s-text>
                      </s-stack>
                      <WorkflowForm
                        intent="unsubscribeFromBlog"
                        identifier={{ name: "blogHostname", value: blog.hostname }}
                        isBusy={isBusy}
                      >
                        <s-button
                          type="submit"
                          variant="tertiary"
                          tone="critical"
                          icon="delete"
                          accessibilityLabel={`Unsubscribe from ${blogName}`}
                        />
                      </WorkflowForm>
                    </s-grid>
                  )
                }
              })}
            />
          )}
        </s-stack>
      </s-section>
    </s-page>
  )
}

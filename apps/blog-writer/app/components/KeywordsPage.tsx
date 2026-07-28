import { useEffect, useState } from "react"
import { useNavigate, useNavigation, useSubmit } from "react-router"
import type { KeywordImportOverview } from "../persistence/keyword-repository.server"
import type { Claim, OpportunityList, OpportunityRow } from "../persistence/opportunity-repository.server"
import { IDEA_TYPE_LABELS, IDEA_TYPE_VALUES } from "./PlanPage"

export type KeywordsPageProps = {
  market: KeywordImportOverview["market"]
  lastImport: KeywordImportOverview["lastImport"]
  list: OpportunityList
  actionResult: { ok: boolean; intent: string } | null
}

type View = "worthWriting" | "setAside"

const DISMISS_MODAL_ID = "keyword-dismiss-modal"
const GENERATE_MODAL_ID = "keyword-generate-modal"
const PAGE_SIZE = 20
/**
 * How old a collection has to be before the section says so.
 *
 * Imports run monthly, so a month alone would call every run stale the day before its replacement arrives. Six weeks
 * is past the point where a scheduled run should have landed, which makes it evidence that one did not.
 */
const STALE_AFTER_MS = 42 * 24 * 60 * 60 * 1000

const numberFormat = new Intl.NumberFormat()
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

/**
 * The scale the score is shown on.
 *
 * Scoring works in fractions of one so its weights read as shares of a whole, but nobody compares rows in hundredths,
 * so the display multiplies rather than the arithmetic.
 */
const SCORE_SCALE = 100

/** How many of a cluster's terms the confirmation names before the list stops being readable. */
const TERMS_SHOWN = 8

// Terms are the search phrases an idea targets, so they carry the search icon rather than a resource icon.
const KEYWORD_ICON = "search"

function points(value: number) {
  return numberFormat.format(Math.round(value * SCORE_SCALE))
}

/**
 * What each part of the score measures, put as the question it answers.
 *
 * The names the scoring code uses are the names of the ideas, not the names a merchant would reach for. "Reachability"
 * and "proof" are precise and mean nothing at a glance, so the popover asks the question each part settles instead.
 */
const COMPONENT_LABELS: Record<string, string> = {
  demand: "How many people search for it",
  reachability: "Whether an article can win it",
  proof: "Whether articles already win it",
  relevance: "How close it is to what you sell",
  distance: "How close you already are",
  ai_overview: "AI answer above the results"
}

/** What each rule found, said as the reason a row is on the list rather than as the rule's own name. */
const SHAPE_LABELS: Record<string, string> = {
  adequately_covered: "Already covered",
  answerable_question: "Question to answer",
  cannibalization: "Two pages competing",
  competitor_gap: "Competitor gap",
  decay: "Losing ground",
  partial_cluster: "Half the set",
  product_page_territory: "Shop page territory",
  rising_demand: "Rising demand",
  seasonal_lead_time: "Season coming",
  striking_distance: "Nearly there",
  weak_hold: "Weak hold",
  out_of_reach: "Out of reach",
  uncovered_catalogue: "Nothing written yet"
}

const VERDICT_LABELS: Record<string, string> = {
  new_article: "Write a new article",
  refresh: "Refresh an article",
  schedule: "Write it before the season",
  no_action: "Leave it alone"
}

type Tone = "neutral" | "info" | "caution" | "success" | "warning" | "critical"

const VERDICT_TONES: Record<string, Tone> = {
  new_article: "success",
  refresh: "info",
  schedule: "caution",
  no_action: "neutral"
}

/** Turns a rule name we have no label for into something readable rather than showing the identifier. */
function humanize(name: string) {
  const spaced = name.replaceAll("_", " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function shapeLabel(detector: string) {
  return SHAPE_LABELS[detector] ?? humanize(detector)
}

function componentLabel(name: string) {
  return COMPONENT_LABELS[name] ?? humanize(name)
}

function verdictLabel(verdict: string) {
  return VERDICT_LABELS[verdict] ?? humanize(verdict)
}

function formatDifficulty(difficulty: number | null) {
  if (difficulty === null) {
    return "Not measured"
  }
  return numberFormat.format(Math.round(difficulty * 10) / 10)
}

/** How many search phrases the subject covers, which says whether a row is one question or a whole topic. */
function termCount(count: number) {
  if (count === 1) {
    return "1 term"
  }
  return `${numberFormat.format(count)} terms`
}

/**
 * When the figures below were measured.
 *
 * The market, the language, and the name of the service the numbers were bought from are settings, not news, so the
 * page does not repeat them. The date is the one dimension that changes what a figure means.
 */
function measuredOn(props: KeywordsPageProps) {
  if (props.list.measuredAt === null) {
    return null
  }
  return `Collected ${dateFormat.format(new Date(props.list.measuredAt))}`
}

/**
 * The one thing worth interrupting the page for.
 *
 * Stacking banners teaches a merchant to scroll past them, so the states are ranked and only the first is shown. An
 * unresolved market outranks everything because nothing below it can be trusted.
 */
function currentBanner(props: KeywordsPageProps) {
  if (props.market === null) {
    return {
      tone: "warning" as const,
      heading: "Search isn't measured yet",
      body: "Choose the country and language to measure search in. Until then there are no keyword figures to show.",
      link: { href: "/app/settings", label: "Open settings" }
    }
  }
  if (props.lastImport?.status === "running") {
    return {
      tone: "info" as const,
      heading: "Collecting keyword data",
      body: "This takes a few minutes. The list below is from the last collection until the new one lands.",
      link: null
    }
  }
  if (props.lastImport?.status === "failed") {
    return {
      tone: "critical" as const,
      heading: "The last collection didn't finish",
      body: "The list below is from the collection before it. Try collecting again from settings.",
      link: { href: "/app/settings", label: "Open settings" }
    }
  }
  if (props.list.measuredAt !== null && Date.now() - new Date(props.list.measuredAt).getTime() > STALE_AFTER_MS) {
    return {
      tone: "warning" as const,
      heading: "These figures are more than six weeks old",
      body: "Search moves. Collect keyword data again to see where the store stands now.",
      link: { href: "/app/settings", label: "Open settings" }
    }
  }
  return null
}

/**
 * The recommendation, with the reasoning behind it one click away.
 *
 * A ranked list that cannot say why a row outranks another is a list a merchant has to take on faith, so the score
 * opens into the parts that made it and the facts behind them. The order answers the question in the order it gets
 * asked: why this subject at all, then how it earned its place.
 */
function Recommendation({ row }: { row: OpportunityRow }) {
  const popoverId = `keyword-score-${row.clusterId}`
  return (
    <s-stack direction="block" gap="small-400">
      <s-stack direction="inline">
        <s-badge tone={VERDICT_TONES[row.verdict] ?? "neutral"}>{verdictLabel(row.verdict)}</s-badge>
      </s-stack>
      {row.scope === null ? null : <s-text color="subdued">{row.scope}</s-text>}
      <s-button commandFor={popoverId} type="button" variant="tertiary">
        Why this ranks here
      </s-button>
      <s-popover id={popoverId} inlineSize="360px">
        <s-box padding="base">
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-500">
              <s-heading>Why it&rsquo;s on the list</s-heading>
              {row.evidence.map((line) => (
                <s-text color="subdued" key={line}>
                  {line}
                </s-text>
              ))}
            </s-stack>

            <s-divider />

            <s-stack direction="block" gap="small-500">
              <s-heading>It scores {points(row.score)} out of 100</s-heading>
              <s-text color="subdued">
                Every subject is measured the same way, and the answers add up to its place in the list.
              </s-text>
            </s-stack>
            <s-stack direction="block" gap="small-300">
              {row.scoreComponents.map((component) => (
                <s-stack direction="block" gap="small-500" key={component.name}>
                  <s-stack direction="inline" gap="base" justifyContent="space-between">
                    <s-text type="strong">{componentLabel(component.name)}</s-text>
                    <s-text>{points(component.value)}</s-text>
                  </s-stack>
                  <s-text color="subdued">{component.reason}</s-text>
                </s-stack>
              ))}
            </s-stack>
          </s-stack>
        </s-box>
      </s-popover>
    </s-stack>
  )
}

/**
 * That a subject has already produced work, said beside the subject rather than in place of the action.
 *
 * It belongs with the subject because it describes the subject, and because a merchant scanning for something to do
 * needs the actions column to hold actions.
 */
function ClaimNote({ claim }: { claim: Claim }) {
  if (claim.kind === "article") {
    return <s-link href={`/app/articles/${claim.id}`}>Written up already</s-link>
  }
  const count = numberFormat.format(claim.count)
  const noun = claim.count === 1 ? "idea" : "ideas"
  return <s-link href="/app/plan">{`${count} ${noun} in your plan`}</s-link>
}

/**
 * What a merchant can do with a row.
 *
 * Generating is offered whatever the subject has already produced, because one angle on a subject is rarely the only
 * one worth writing. Dismissal never sits beside the ordinary action: undoing a written article is easy, and undoing a
 * subject a merchant stopped seeing is not.
 */
function RowActions({
  row,
  isGenerating,
  isRestoring,
  onGenerate,
  onDismiss,
  onRestore
}: {
  row: OpportunityRow
  isGenerating: boolean
  isRestoring: boolean
  onGenerate: () => void
  onDismiss: () => void
  onRestore: () => void
}) {
  if (row.isDismissed) {
    return (
      <s-stack direction="block" gap="small-400">
        <s-stack direction="inline">
          <s-badge tone="neutral">Dismissed</s-badge>
        </s-stack>
        <s-button loading={isRestoring} onClick={onRestore} type="button" variant="tertiary">
          Put it back
        </s-button>
      </s-stack>
    )
  }

  const menuId = `keyword-actions-${row.clusterId}`
  return (
    // The table cell is free to shrink, and s-stack lays out with display:contents, so the buttons need a real box of
    // their own to stay on one line instead of stacking under each other.
    <div style={{ alignItems: "center", display: "flex", gap: "0.5rem", whiteSpace: "nowrap" }}>
      <s-button
        command="--show"
        commandFor={GENERATE_MODAL_ID}
        loading={isGenerating}
        onClick={onGenerate}
        type="button"
      >
        Generate an idea
      </s-button>
      <s-button
        accessibilityLabel={`More actions for ${row.cluster.headKeyword}`}
        commandFor={menuId}
        icon="menu-horizontal"
        type="button"
        variant="tertiary"
      />
      <s-menu accessibilityLabel={`More actions for ${row.cluster.headKeyword}`} id={menuId}>
        <s-button
          accessibilityLabel={`Dismiss ${row.cluster.headKeyword}`}
          command="--show"
          commandFor={DISMISS_MODAL_ID}
          icon="hide"
          onClick={onDismiss}
          tone="critical"
          type="button"
        >
          Dismiss this subject
        </s-button>
      </s-menu>
    </div>
  )
}

/**
 * Why the list is empty, which is a different sentence depending on whether the merchant narrowed it.
 *
 * An empty set-aside list is the ordinary state of a store that has dismissed nothing, so saying "nothing matches"
 * would send the reader looking for a filter that isn't there.
 */
function emptyListMessage(view: View, needle: string) {
  if (needle !== "") {
    return "Nothing matches that. Clear the search to see the whole list."
  }
  if (view === "setAside") {
    return "You haven't set any subjects aside."
  }
  return "There are no subjects worth writing about yet."
}

export function KeywordsPage(props: KeywordsPageProps) {
  const submit = useSubmit()
  const navigation = useNavigation()
  const isBusy = navigation.state !== "idle"
  // Generating takes the better part of a minute, so the row that asked for it carries the spinner and every other
  // row stays usable rather than the whole list going flat while one subject is worked on.
  const running = navigation.formData
  const runningClusterId = running === undefined ? null : String(running.get("clusterId"))
  const runningIntent = running === undefined ? null : String(running.get("intent"))
  const [view, setView] = useState<View>("worthWriting")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [pendingDismissal, setPendingDismissal] = useState<OpportunityRow | null>(null)
  const [reason, setReason] = useState("")
  const [pendingIdea, setPendingIdea] = useState<OpportunityRow | null>(null)
  const [focus, setFocus] = useState("")
  const [ideaType, setIdeaType] = useState<string>("any")
  const [terms, setTerms] = useState<string[]>([])
  const [termInput, setTermInput] = useState("")
  const navigate = useNavigate()

  // Adding an idea is a moment rather than a state of the page, so it is announced and then gone.
  useEffect(() => {
    if (props.actionResult?.ok === true && props.actionResult.intent === "generateIdea") {
      shopify.toast.show("Idea added to your plan", {
        action: "View plan",
        onAction: () => navigate("/app/plan")
      })
    }
  }, [props.actionResult, navigate])

  const banner = currentBanner(props)
  const collected = measuredOn(props)
  const source = view === "worthWriting" ? props.list.opportunities : props.list.suppressed
  const needle = query.trim().toLowerCase()
  const matching =
    needle === "" ? source : source.filter((row) => row.cluster.headKeyword.toLowerCase().includes(needle))
  // A filter that leaves the reader on page four of a one-page result is a filter that looks broken.
  const currentPage = Math.min(page, Math.max(0, Math.ceil(matching.length / PAGE_SIZE) - 1))
  const visible = matching.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  function changeView(next: View) {
    setView(next)
    setPage(0)
  }

  function changeQuery(next: string) {
    setQuery(next)
    setPage(0)
  }

  function addTerm() {
    const term = termInput.trim()
    if (term.length > 0 && !terms.includes(term)) {
      setTerms((current) => [...current, term])
    }
    setTermInput("")
  }

  return (
    <s-page heading="Keywords" inlineSize="large">
      {banner === null ? null : (
        <s-banner heading={banner.heading} slot="supplemental-start" tone={banner.tone}>
          <s-stack direction="block" gap="small-300">
            <s-paragraph>{banner.body}</s-paragraph>
            {banner.link === null ? null : <s-link href={banner.link.href}>{banner.link.label}</s-link>}
          </s-stack>
        </s-banner>
      )}

      {props.actionResult?.ok === false ? (
        <s-banner tone="critical">That didn&rsquo;t finish. Try it again.</s-banner>
      ) : null}

      {props.market === null || props.list.importId === null ? (
        <EmptyState hasMarket={props.market !== null} />
      ) : (
        <s-section accessibilityLabel="Opportunities" padding="none">
          <s-box padding="base">
            <s-stack direction="block" gap="base">
              <s-text color="subdued">{collected ?? ""}</s-text>
              <s-grid alignItems="end" gap="base" gridTemplateColumns="1fr auto">
                <s-search-field
                  label="Search subjects"
                  labelAccessibilityVisibility="exclusive"
                  onInput={(event) => changeQuery(event.currentTarget.value)}
                  placeholder="Search subjects"
                  value={query}
                />
                <s-box maxInlineSize="220px">
                  <s-select
                    label="Show"
                    labelAccessibilityVisibility="exclusive"
                    name="view"
                    onChange={(event) =>
                      changeView(event.currentTarget.value === "setAside" ? "setAside" : "worthWriting")
                    }
                    value={view}
                  >
                    <s-option value="worthWriting">Worth writing</s-option>
                    <s-option value="setAside">Set aside</s-option>
                  </s-select>
                </s-box>
              </s-grid>
            </s-stack>
          </s-box>

          {visible.length === 0 ? (
            <s-box padding="base" paddingBlockStart="none">
              <s-paragraph>{emptyListMessage(view, needle)}</s-paragraph>
            </s-box>
          ) : (
            <s-table
              hasNextPage={(currentPage + 1) * PAGE_SIZE < matching.length}
              hasPreviousPage={currentPage > 0}
              onNextPage={() => setPage(currentPage + 1)}
              onPreviousPage={() => setPage(currentPage - 1)}
              paginate
              variant="auto"
            >
              <s-table-header-row>
                <s-table-header listSlot="kicker">Why</s-table-header>
                <s-table-header listSlot="primary">Subject</s-table-header>
                <s-table-header listSlot="secondary">Recommendation</s-table-header>
                <s-table-header format="numeric">Score</s-table-header>
                <s-table-header format="numeric">Monthly searches</s-table-header>
                <s-table-header format="numeric">Difficulty</s-table-header>
                <s-table-header listSlot="inline">Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {visible.map((row) => (
                  <s-table-row key={row.clusterId}>
                    <s-table-cell>{shapeLabel(row.detector)}</s-table-cell>
                    <s-table-cell>
                      <s-stack direction="block" gap="small-500">
                        <s-text>{row.cluster.headKeyword}</s-text>
                        <s-text color="subdued">{termCount(row.cluster.keywordCount)}</s-text>
                        {row.claim === null ? null : <ClaimNote claim={row.claim} />}
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>
                      <Recommendation row={row} />
                    </s-table-cell>
                    <s-table-cell>{points(row.score)}</s-table-cell>
                    <s-table-cell>{numberFormat.format(row.cluster.demand)}</s-table-cell>
                    <s-table-cell>{formatDifficulty(row.cluster.difficulty)}</s-table-cell>
                    <s-table-cell>
                      <RowActions
                        isGenerating={runningIntent === "generateIdea" && row.clusterId === runningClusterId}
                        isRestoring={runningIntent === "restoreCluster" && row.clusterId === runningClusterId}
                        onDismiss={() => {
                          setPendingDismissal(row)
                          setReason("")
                        }}
                        onGenerate={() => {
                          setPendingIdea(row)
                          setFocus(row.cluster.headKeyword)
                          setIdeaType("any")
                          setTerms(row.cluster.keywords.slice(0, TERMS_SHOWN))
                          setTermInput("")
                        }}
                        onRestore={() =>
                          submit({ intent: "restoreCluster", clusterId: row.clusterId }, { method: "post" })
                        }
                        row={row}
                      />
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      )}

      <s-modal accessibilityLabel="Dismiss this subject" heading="Dismiss this subject" id={DISMISS_MODAL_ID}>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            {pendingDismissal === null
              ? "This subject stops appearing in the list."
              : `“${pendingDismissal.cluster.headKeyword}” stops appearing in the list, and stays out after the next collection.`}
          </s-paragraph>
          <s-text-area
            label="Why is it not worth writing?"
            name="reason"
            onInput={(event) => setReason(event.currentTarget.value)}
            placeholder="We don't sell this"
            rows={3}
            value={reason}
          />
        </s-stack>
        <s-button
          command="--hide"
          commandFor={DISMISS_MODAL_ID}
          disabled={isBusy || reason.trim() === ""}
          onClick={() => {
            if (pendingDismissal !== null) {
              submit(
                {
                  intent: "dismissCluster",
                  clusterId: pendingDismissal.clusterId,
                  headKeyword: pendingDismissal.cluster.headKeyword,
                  reason: reason.trim()
                },
                { method: "post" }
              )
            }
          }}
          slot="primary-action"
          tone="critical"
          variant="primary"
        >
          Dismiss it
        </s-button>
        <s-button command="--hide" commandFor={DISMISS_MODAL_ID} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
      <s-modal accessibilityLabel="Generate an idea" heading="Generate an idea" id={GENERATE_MODAL_ID}>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            {pendingIdea === null
              ? "Check what the idea should cover before generating it."
              : `This idea is drawn from “${pendingIdea.cluster.headKeyword}”. Drop the terms it shouldn’t chase, and add any it missed.`}
          </s-paragraph>
          <s-text-area
            label="Topic or audience"
            name="focus"
            onInput={(event) => setFocus(event.currentTarget.value)}
            rows={3}
            value={focus}
          />
          <s-stack direction="block" gap="small">
            <s-grid alignItems="end" gap="small" gridTemplateColumns="1fr auto">
              <s-text-field
                label="Add a term"
                onChange={(event) => setTermInput(event.currentTarget.value)}
                value={termInput}
              />
              <s-button accessibilityLabel="Add a term to this idea" onClick={addTerm}>
                Add
              </s-button>
            </s-grid>
            <s-stack direction="inline" gap="small">
              {terms.length === 0 ? <s-paragraph>No terms yet.</s-paragraph> : null}
              {terms.map((term) => (
                <s-clickable-chip
                  key={term}
                  onRemove={() => setTerms((current) => current.filter((entry) => entry !== term))}
                  removable
                >
                  <s-icon slot="graphic" type={KEYWORD_ICON} />
                  {term}
                </s-clickable-chip>
              ))}
            </s-stack>
          </s-stack>
          <s-box maxInlineSize="256px">
            <s-select
              label="Idea format"
              name="ideaType"
              onChange={(event) => setIdeaType(event.currentTarget.value)}
              value={ideaType}
            >
              {IDEA_TYPE_VALUES.map((value) => (
                <s-option key={value} value={value}>
                  {IDEA_TYPE_LABELS[value]}
                </s-option>
              ))}
            </s-select>
          </s-box>
          <s-text color="subdued">AI can make mistakes. Check important info.</s-text>
        </s-stack>
        <s-button
          command="--hide"
          commandFor={GENERATE_MODAL_ID}
          disabled={isBusy || focus.trim().length < 3}
          onClick={() => {
            if (pendingIdea !== null) {
              submit(
                {
                  intent: "generateIdea",
                  clusterId: pendingIdea.clusterId,
                  focus: focus.trim(),
                  ideaType,
                  keywords: terms.join("\n")
                },
                { method: "post" }
              )
            }
          }}
          slot="primary-action"
          variant="primary"
        >
          Generate idea
        </s-button>
        <s-button command="--hide" commandFor={GENERATE_MODAL_ID} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  )
}

/** What the section says before it has anything measured to say. */
function EmptyState({ hasMarket }: { hasMarket: boolean }) {
  return (
    <s-section heading="No keyword data yet">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          {hasMarket
            ? "Collect keyword data to see which subjects are worth writing about, and why."
            : "Choose the country and language to measure search in, then collect keyword data."}
        </s-paragraph>
        <s-link href="/app/settings">Open settings</s-link>
      </s-stack>
    </s-section>
  )
}

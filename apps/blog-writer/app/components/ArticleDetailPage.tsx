import { useMediaQuery } from "@mantine/hooks"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { Fragment, useEffect, useRef, useState } from "react"
import { Form, useFetcher, useNavigation, useSubmit } from "react-router"
import { toArticleHandle } from "../articles/article-handle"
import type { ArticleVersion, DiffPart, VersionContent } from "../articles/version-diff"
import { diffVersions } from "../articles/version-diff"
import { useAiFieldMark } from "../hooks/use-ai-field-mark"
import { pickShopifyImage } from "../lib/shopify-file-picker"
import type { ArticleDetail, DestinationBlog, StoreProfile } from "../persistence/blog-workspace-repository.server"
import { ArticleEditor } from "./ArticleEditor"
import { pickEditorImage, rewriteEditorText, searchLinkableResources } from "./editor/editor-services"
import type { ActionResult } from "./WorkflowForm"
import "./ArticleDetailPage.css"
import "./VersionDiff.css"

type Recommendation = ArticleDetail["recommendations"][number]
type DestinationType = Recommendation["destinationType"]
type StatusTone = "neutral" | "info" | "caution" | "success" | "warning" | "critical"

const ARTICLE_FORM_ID = "article-editor"
const ACTIONS_MENU_ID = "article-actions"
const DELETE_MODAL_ID = "delete-article"
const IMAGE_MODAL_ID = "generate-image"
const SAVE_BAR_ID = "article-save-bar"
const TITLE_MODAL_ID = "rewrite-title"
const VERSION_MODAL_ID = "version-diff"

// Below 1024px the sidebar drops under the editor, and the admin title bar runs out of room for the heading, the
// status, and the actions on one line. Both changes read this one query so they happen together.
const NARROW_VIEWPORT = "(width < 64rem)"

/** Search engines truncate a listing near these lengths, so the counters warn before the text is cut off. */
const SEO_TITLE_LIMIT = 70
const SEO_DESCRIPTION_LIMIT = 160
/** Matches the tag ceiling the article action enforces. */
const MAXIMUM_TAGS = 20

/** How many author names the field offers at once, so the list stays short enough to read at a glance. */
const AUTHOR_SUGGESTION_LIMIT = 6

/** Every store starts with a blog on this handle, so an address can be shown before a blog is chosen. */
const DEFAULT_BLOG_HANDLE = "news"

/**
 * The editor takes every pixel the window offers and the sidebar keeps a fixed width, because an article and its
 * settings need room to read. On a narrow viewport the sidebar drops under the editor rather than squeezing it.
 */
const WIDE_COLUMNS = "minmax(0, 1fr) 20rem"
const STACKED_COLUMNS = "minmax(0, 1fr)"

/**
 * App Bridge renders the save bar's buttons itself and reads their variant from an attribute, which is not part of
 * the DOM button type.
 */
const saveBarPrimaryAction = { variant: "primary" } as ButtonHTMLAttributes<HTMLButtonElement>

/** The part of the App Bridge save bar element this page drives; the admin defines the rest. */
type SaveBarElement = HTMLElement & { show?: () => Promise<void>; hide?: () => Promise<void> }

/**
 * Shared so a field that is already marked hands the same set back, which leaves the state untouched rather than
 * re-rendering the whole form.
 */
const NO_AI_FIELDS: ReadonlySet<string> = new Set()

export type ArticleDetailPageProps = {
  article: ArticleDetail
  versions: ArticleVersion[]
  workingCopy: VersionContent
  totalVersionCount: number
  destinationBlogs: DestinationBlog[]
  store: StoreProfile
  authorSuggestions: string[]
  linkableDestinations: { commercial: number; reading: number }
  actionResult: ActionResult
}

const STATUS_LABELS: Record<ArticleDetail["status"], string> = {
  draft: "Draft",
  needs_review: "Needs review",
  ready_to_publish: "Ready to publish",
  published: "Published",
  needs_attention: "Needs attention",
  failed: "Failed"
}

const STATUS_TONES: Record<ArticleDetail["status"], StatusTone> = {
  draft: "neutral",
  needs_review: "caution",
  ready_to_publish: "info",
  published: "success",
  needs_attention: "warning",
  failed: "critical"
}

// Suggestions reuse the articles list icon set so a destination reads as the same storefront resource type everywhere.
const DESTINATION_ICONS = {
  product: "product",
  collection: "collection",
  blog: "blog",
  article: "blog",
  page: "page"
} as const

const DESTINATION_LABELS: Record<DestinationType, string> = {
  product: "Product",
  collection: "Collection",
  blog: "Blog",
  article: "Article",
  page: "Page"
}

const REVISION_ORIGIN_LABELS: Record<ArticleVersion["origin"], string> = {
  generated: "Generated",
  edited: "Edited",
  regenerated: "Regenerated",
  imported: "Imported"
}

/** One sentence for where readers stand, because a status badge alone does not say what they can see. */
function getPublishingSummary(isPublished: boolean, hasUnpublishedChanges: boolean) {
  if (hasUnpublishedChanges) {
    return "Readers still see the version you published last."
  }
  if (isPublished) {
    return "Readers see your latest saved version."
  }
  return "This article isn't on your online store yet."
}

const SUCCESS_MESSAGES: Record<string, string> = {
  refreshCrosslinks: "Storefront link suggestions are ready.",
  refreshFurtherReading: "Further reading suggestions are ready.",
  regenerateArticle: "The rewritten blog post is saved as a new version.",
  addSuggestion: "Link added.",
  removeSuggestion: "Link removed.",
  saveArticle: "Your changes are saved as a new version.",
  restoreRevision: "That version is now the working copy.",
  deleteRevision: "That version is deleted.",
  publishArticle: "Published to your online store.",
  unpublishArticle: "Hidden from your online store."
}

// A suggestion run that comes back with nothing worked exactly as asked, so it is reported plainly rather than as luck.
const NO_SUGGESTION_MESSAGES: Record<string, string> = {
  refreshCrosslinks: "No storefront links matched this article.",
  refreshFurtherReading: "No further reading matched this article."
}

/** Says why a suggestion panel is empty, because "none yet" reads the same whether the writer looked or not. */
function getSuggestionEmptyMessage(
  messages: { noDestinations: string; noMatch: string; notAsked: string },
  destinationCount: number,
  hasJustRefreshed: boolean
) {
  if (destinationCount === 0) {
    return messages.noDestinations
  }
  if (hasJustRefreshed) {
    return messages.noMatch
  }
  return messages.notAsked
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function ActionBanner({
  actionResult,
  suggestionCounts
}: {
  actionResult: ActionResult
  suggestionCounts: Record<string, number>
}) {
  if (actionResult === null) {
    return null
  }
  if (!actionResult.ok) {
    return <s-banner tone="critical">{actionResult.error ?? "That action didn't finish. Try it again."}</s-banner>
  }
  if (suggestionCounts[actionResult.intent] === 0) {
    return <s-banner tone="info">{NO_SUGGESTION_MESSAGES[actionResult.intent]}</s-banner>
  }
  return <s-banner tone="success">{SUCCESS_MESSAGES[actionResult.intent] ?? "Done."}</s-banner>
}

/** One suggestion, shown as a chip that adds with a plus and removes with the chip's cancel control. */
function SuggestionChip({ recommendation, isBusy }: { recommendation: Recommendation; isBusy: boolean }) {
  const submit = useSubmit()
  const isAdded = recommendation.status === "accepted"
  const tooltipId = `suggestion-${recommendation.recommendationId}`
  const detail = `${DESTINATION_LABELS[recommendation.destinationType]} linked from ${recommendation.sectionLocator}. ${recommendation.rationale}`

  function review(intent: "addSuggestion" | "removeSuggestion") {
    submit({ intent, recommendationId: recommendation.recommendationId }, { method: "post" })
  }

  return (
    <Fragment>
      {isAdded ? (
        <s-clickable-chip
          accessibilityLabel={`Open ${recommendation.destinationTitle}`}
          disabled={isBusy}
          interestFor={tooltipId}
          onClick={() => window.open(recommendation.destinationUrl, "_blank", "noopener")}
          onRemove={() => review("removeSuggestion")}
          removable
        >
          <s-icon slot="graphic" type={DESTINATION_ICONS[recommendation.destinationType]} />
          {recommendation.destinationTitle}
        </s-clickable-chip>
      ) : (
        <s-clickable-chip
          accessibilityLabel={`Add ${recommendation.destinationTitle}`}
          disabled={isBusy}
          interestFor={tooltipId}
          onClick={() => review("addSuggestion")}
        >
          <s-icon slot="graphic" type="plus" />
          {recommendation.destinationTitle}
        </s-clickable-chip>
      )}
      <s-tooltip id={tooltipId}>{detail}</s-tooltip>
    </Fragment>
  )
}

type CollapsibleSectionProps = {
  action?: ReactNode
  children: ReactNode
  heading: string
  isInitiallyExpanded?: boolean
}

/** A sidebar panel that starts collapsed so the sidebar stays scannable. */
function CollapsibleSection({ action, children, heading, isInitiallyExpanded = false }: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded)

  return (
    <s-section accessibilityLabel={heading}>
      <s-stack direction="block" gap="small">
        <s-grid gridTemplateColumns="1fr auto" gap="small-100" alignItems="center">
          <s-clickable
            accessibilityLabel={`${isExpanded ? "Collapse" : "Expand"} ${heading}`}
            borderRadius="base"
            padding="small-300"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <s-stack direction="inline" gap="small-100" alignItems="center">
              <s-icon type={isExpanded ? "chevron-up" : "chevron-down"} />
              <s-heading>{heading}</s-heading>
            </s-stack>
          </s-clickable>
          {action}
        </s-grid>
        {isExpanded ? children : null}
      </s-stack>
    </s-section>
  )
}

type SuggestionSectionProps = {
  description: string
  emptyMessage: string
  heading: string
  isBusy: boolean
  recommendations: Recommendation[]
  refreshIntent: "refreshCrosslinks" | "refreshFurtherReading"
  refreshLabel: string
}

/** A sidebar panel of suggestion chips with a control that asks for a fresh set. */
function SuggestionSection({
  description,
  emptyMessage,
  heading,
  isBusy,
  recommendations,
  refreshIntent,
  refreshLabel
}: SuggestionSectionProps) {
  const navigation = useNavigation()
  const submit = useSubmit()
  const tooltipId = `${refreshIntent}-tooltip`
  // Only the panel that asked for a fresh set spins; the rest of the page simply waits.
  const isRefreshing = navigation.formData?.get("intent") === refreshIntent

  return (
    <CollapsibleSection
      action={
        <Fragment>
          <s-button
            accessibilityLabel={refreshLabel}
            disabled={isBusy && !isRefreshing}
            icon="wand"
            interestFor={tooltipId}
            loading={isRefreshing}
            onClick={() => submit({ intent: refreshIntent }, { method: "post" })}
            type="button"
            variant="tertiary"
          />
          <s-tooltip id={tooltipId}>{refreshLabel}</s-tooltip>
        </Fragment>
      }
      heading={heading}
    >
      <s-stack direction="block" gap="small">
        <s-text color="subdued">{description}</s-text>
        {recommendations.length === 0 ? (
          <s-text color="subdued">{emptyMessage}</s-text>
        ) : (
          <s-stack direction="inline" gap="small-100">
            {recommendations.map((recommendation) => (
              <SuggestionChip isBusy={isBusy} key={recommendation.recommendationId} recommendation={recommendation} />
            ))}
          </s-stack>
        )}
      </s-stack>
    </CollapsibleSection>
  )
}

/** Capitalizes the opening word so a tag reads as a label rather than raw typing. */
function toTagLabel(tag: string) {
  return `${tag.charAt(0).toLocaleUpperCase()}${tag.slice(1)}`
}

/**
 * Tags entered one at a time and shown as removable chips.
 * The value travels in a hidden field because the chips, not a text box, hold the list once a tag is committed.
 */
function TagField({
  initialTags,
  isDisabled,
  onChange
}: {
  initialTags: string[]
  isDisabled: boolean
  onChange: () => void
}) {
  const [tags, setTags] = useState(initialTags)
  const entryRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)

  function commit(next: string[]) {
    setTags(next)
    onChange()
  }

  function addTag() {
    const entry = entryRef.current
    if (entry === null) {
      return
    }
    const tag = entry.value.trim()
    entry.value = ""
    if (tag === "" || tags.includes(tag) || tags.length >= MAXIMUM_TAGS) {
      return
    }
    commit([...tags, tag])
  }

  return (
    <s-stack direction="block" gap="small-100">
      {/* Keydown is not part of the Polaris field API, so the wrapper catches the event as it bubbles out. */}
      <div
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            addTag()
          }
        }}
        role="presentation"
      >
        <s-text-field disabled={isDisabled} label="Tags" onBlur={addTag} ref={entryRef} />
      </div>
      {tags.length === 0 ? null : (
        <s-stack direction="inline" gap="small-100">
          {tags.map((tag) => (
            <s-clickable-chip
              accessibilityLabel={`Remove ${tag}`}
              disabled={isDisabled}
              key={tag}
              onRemove={() => commit(tags.filter((existing) => existing !== tag))}
              removable
            >
              {toTagLabel(tag)}
            </s-clickable-chip>
          ))}
        </s-stack>
      )}
      <input name="tags" type="hidden" value={tags.join(",")} />
    </s-stack>
  )
}

/**
 * The byline, typed freely, with the names this store has published under offered as the merchant types.
 * Polaris has no combobox element, so the matches are ordinary buttons under the field: the arrow keys walk into
 * them and Escape comes back, which keeps the list reachable without claiming ARIA relationships that cannot cross
 * the field's shadow boundary.
 */
function AuthorField({
  initialAuthor,
  isDisabled,
  suggestions
}: {
  initialAuthor: string
  isDisabled: boolean
  suggestions: string[]
}) {
  const [author, setAuthor] = useState(initialAuthor)
  const [isOpen, setIsOpen] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const fieldRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const listRef = useRef<HTMLFieldSetElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  // Arriving in the field is a chance to browse every name; typing is a chance to narrow them down.
  const term = isFiltering ? author.trim().toLowerCase() : ""
  const matches = suggestions
    .filter((name) => name.toLowerCase() !== author.trim().toLowerCase() && name.toLowerCase().includes(term))
    .slice(0, AUTHOR_SUGGESTION_LIMIT)
  const isShowingMatches = isOpen && matches.length > 0

  function choose(name: string) {
    const field = fieldRef.current
    if (field !== null) {
      field.value = name
      // A value set from code raises no event, so the form has to be told the byline moved away from the saved one.
      field.dispatchEvent(new Event("input", { bubbles: true }))
      field.focus()
    }
    setAuthor(name)
    setIsOpen(false)
  }

  function moveFocus(offset: number) {
    const options = Array.from(listRef.current?.querySelectorAll("button") ?? [])
    if (options.length === 0) {
      return
    }
    const active = document.activeElement
    const current = active instanceof HTMLButtonElement ? options.indexOf(active) : -1
    if (current === -1) {
      options[offset > 0 ? 0 : options.length - 1]?.focus()
      return
    }
    options[(current + offset + options.length) % options.length]?.focus()
  }

  return (
    // Keydown and focus are not part of the Polaris field API, so the wrapper catches them as they bubble out.
    <div
      className="article-author"
      onBlur={() => {
        // The field reports leaving its own shadow root without naming where focus went, so the answer waits a frame.
        requestAnimationFrame(() => {
          if (wrapperRef.current?.contains(document.activeElement) !== true) {
            setIsOpen(false)
          }
        })
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault()
          moveFocus(1)
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          moveFocus(-1)
        }
        if (event.key === "Escape" && isShowingMatches) {
          // Focus returns to the field before the list goes, so leaving the list never drops focus on the page body.
          event.preventDefault()
          fieldRef.current?.focus()
          setIsOpen(false)
        }
      }}
      ref={wrapperRef}
      role="presentation"
    >
      <s-text-field
        disabled={isDisabled}
        label="Author"
        name="author"
        onFocus={() => {
          setIsOpen(true)
          setIsFiltering(false)
        }}
        onInput={(event) => {
          setAuthor(event.currentTarget.value)
          setIsFiltering(true)
          setIsOpen(true)
        }}
        ref={fieldRef}
        value={initialAuthor}
      />
      {isShowingMatches ? (
        <fieldset aria-label="Author suggestions" className="article-author__suggestions" ref={listRef}>
          {matches.map((name) => (
            <button className="article-author__suggestion" key={name} onClick={() => choose(name)} type="button">
              {name}
            </button>
          ))}
        </fieldset>
      ) : null}
    </div>
  )
}

/** The article's featured image, uploaded to Shopify Files so the storefront can serve it. */
function ImageSection({
  initialAltText,
  initialImageUrl,
  isAiWritten,
  isDisabled,
  onAiWrite,
  onChange,
  title
}: {
  initialAltText: string
  initialImageUrl: string | null
  isAiWritten: boolean
  isDisabled: boolean
  onAiWrite: () => void
  onChange: () => void
  title: string
}) {
  const fetcher = useFetcher<{
    ok: boolean
    intent?: string
    error?: string
    imageUrl?: string
    imageAltText?: string
  }>()
  const [isRemoved, setIsRemoved] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const altTextRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const instructionRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const uploadedUrl = fetcher.data?.ok === true ? (fetcher.data.imageUrl ?? null) : null
  // Shopify already knows how a stored file was described, so picking one brings its alt text along.
  const pickedAltText = fetcher.data?.ok === true ? (fetcher.data.imageAltText ?? null) : null
  // What is on show is whatever the last upload returned, until the merchant takes it off again.
  const imageUrl = isRemoved ? null : (uploadedUrl ?? initialImageUrl)
  const failure = fetcher.data?.ok === false ? fetcher.data : null
  const isGenerated = fetcher.data?.intent === "generateImage"

  function upload(files: FileList | null) {
    const file = files?.[0]
    if (file === undefined) {
      return
    }
    setIsRemoved(false)
    onChange()
    const payload = new FormData()
    payload.set("intent", "uploadImage")
    payload.set("image", file)
    fetcher.submit(payload, { encType: "multipart/form-data", method: "post" })
  }

  /** Opens the admin's own file picker, so this field browses the same store files every other image field does. */
  async function choose() {
    const picked = await pickShopifyImage()
    if (picked === null) {
      return
    }
    if ("error" in picked) {
      shopify.toast.show(picked.error, { isError: true })
      return
    }
    setIsRemoved(false)
    onChange()
    const payload = new FormData()
    payload.set("intent", "resolveImage")
    payload.set("imageId", picked.imageId)
    fetcher.submit(payload, { method: "post" })
  }

  function requestImage() {
    setIsRemoved(false)
    onChange()
    fetcher.submit(
      { instruction: instructionRef.current?.value ?? "", intent: "generateImage", title },
      { method: "post" }
    )
  }

  // A drawn image arrives the same way an uploaded one does, so only the modal has to be told the request landed.
  useEffect(() => {
    if (fetcher.data?.ok !== true || fetcher.data.intent !== "generateImage") {
      return
    }
    onAiWrite()
    document.querySelector<HTMLElementTagNameMap["s-modal"]>(`#${IMAGE_MODAL_ID}`)?.hideOverlay()
  }, [fetcher.data, onAiWrite])

  const isUploading = fetcher.state !== "idle"
  useAiFieldMark(altTextRef, isAiWritten)

  return (
    <Fragment>
      <s-section accessibilityLabel="Image">
        <s-stack direction="block" gap="small">
          <s-grid gridTemplateColumns="1fr auto" gap="small-100" alignItems="center">
            <s-heading>Image</s-heading>
            <s-button
              accessibilityLabel="Generate an image for this article"
              command="--show"
              commandFor={IMAGE_MODAL_ID}
              disabled={isDisabled || isUploading}
              icon="image-magic"
              interestFor="generate-image-tooltip"
              type="button"
              variant="tertiary"
            />
          </s-grid>
          <s-tooltip id="generate-image-tooltip">Generate image</s-tooltip>
          {failure !== null && !isGenerated ? (
            <s-banner tone="critical">{failure.error ?? "That image could not be added."}</s-banner>
          ) : null}
          {imageUrl === null ? (
            <div
              className="article-image-drop"
              data-dragging={isDragging}
              onDragLeave={() => setIsDragging(false)}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragging(false)
                upload(event.dataTransfer.files)
              }}
            >
              <s-button disabled={isDisabled || isUploading} onClick={() => void choose()} type="button">
                Add image
              </s-button>
              <span className="article-image-hint">or drop an image to upload</span>
            </div>
          ) : (
            <s-stack direction="block" gap="small-100">
              {/* The mark hugs the picture itself, so the controls around it are not caught up in it. */}
              <div className={isAiWritten ? "article-ai-field article-ai-field--image" : undefined}>
                <s-thumbnail alt={initialAltText} size="large" src={imageUrl} />
              </div>
              <s-button
                disabled={isDisabled || isUploading}
                onClick={() => {
                  setIsRemoved(true)
                  onChange()
                }}
                type="button"
                variant="tertiary"
              >
                Remove image
              </s-button>
            </s-stack>
          )}
          {isUploading ? <s-text color="subdued">Adding your image to Shopify.</s-text> : null}
          {/* Alt text describes an image, so it appears once there is one to describe. */}
          {imageUrl === null ? (
            <input name="imageAltText" type="hidden" value="" />
          ) : (
            <s-text-field
              details="Describes the image for readers who cannot see it."
              disabled={isDisabled}
              label="Alt text"
              name="imageAltText"
              ref={altTextRef}
              value={pickedAltText ?? initialAltText}
            />
          )}
          <input name="imageUrl" type="hidden" value={imageUrl ?? ""} />
        </s-stack>
      </s-section>
      <s-modal heading="Generate image" id={IMAGE_MODAL_ID}>
        <s-stack direction="block" gap="base">
          <s-paragraph>Describe the picture you want, and the writer draws one to go with this article.</s-paragraph>
          {failure !== null && isGenerated ? (
            <s-banner tone="critical">{failure.error ?? "That image couldn't be drawn. Try it again."}</s-banner>
          ) : null}
          <s-text-field
            label="Describe the image"
            placeholder="A family pitching a tent in light rain"
            ref={instructionRef}
          />
        </s-stack>
        <s-button loading={isUploading} onClick={requestImage} slot="primary-action" variant="primary">
          Generate image
        </s-button>
        <s-button command="--hide" commandFor={IMAGE_MODAL_ID} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
    </Fragment>
  )
}

/** The headline, with a control that asks the workflow to rewrite it from an instruction the merchant writes. */
function TitleField({
  initialTitle,
  isAiWritten,
  isDisabled,
  onAiWrite,
  onChange
}: {
  initialTitle: string
  isAiWritten: boolean
  isDisabled: boolean
  onAiWrite: () => void
  onChange: (title: string) => void
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string; title?: string }>()
  const titleRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const instructionRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const rewrittenTitle = fetcher.data?.ok === true ? (fetcher.data.title ?? null) : null
  useAiFieldMark(titleRef, isAiWritten)
  useEffect(() => {
    if (rewrittenTitle === null) {
      return
    }
    if (titleRef.current !== null) {
      titleRef.current.value = rewrittenTitle
      // A value set from code raises no event, so the form has to be told that the title moved away from the saved one.
      titleRef.current.dispatchEvent(new Event("input", { bubbles: true }))
    }
    onChange(rewrittenTitle)
    onAiWrite()
    document.querySelector<HTMLElementTagNameMap["s-modal"]>(`#${TITLE_MODAL_ID}`)?.hideOverlay()
  }, [onAiWrite, onChange, rewrittenTitle])

  function requestRewrite() {
    fetcher.submit(
      {
        instruction: instructionRef.current?.value ?? "",
        intent: "rewriteTitle",
        title: titleRef.current?.value ?? initialTitle
      },
      { method: "post" }
    )
  }

  return (
    <Fragment>
      <s-text-field
        disabled={isDisabled}
        label="Title"
        name="title"
        onInput={(event) => onChange(event.currentTarget.value)}
        ref={titleRef}
        value={initialTitle}
      >
        <s-button
          accessibilityLabel="Rewrite the title with AI"
          command="--show"
          commandFor={TITLE_MODAL_ID}
          disabled={isDisabled}
          icon="wand"
          slot="accessory"
          type="button"
          variant="tertiary"
        />
      </s-text-field>
      <s-modal heading="Rewrite title" id={TITLE_MODAL_ID}>
        <s-stack direction="block" gap="base">
          <s-paragraph>Tell the writer what to change, and it rewrites the title you have now.</s-paragraph>
          {fetcher.data?.ok === false ? (
            <s-banner tone="critical">{fetcher.data.error ?? "That rewrite didn't finish. Try it again."}</s-banner>
          ) : null}
          <s-text-field
            label="Describe the changes"
            placeholder="Shorter, and say who the trip is for"
            ref={instructionRef}
          />
        </s-stack>
        <s-button loading={fetcher.state !== "idle"} onClick={requestRewrite} slot="primary-action" variant="primary">
          Rewrite title
        </s-button>
        <s-button command="--hide" commandFor={TITLE_MODAL_ID} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
    </Fragment>
  )
}

/** How the article appears in search results, with the fields that change it kept behind an edit control. */
function SearchListingSection({
  article,
  blogHandle,
  isDisabled,
  store,
  title
}: {
  article: ArticleDetail
  blogHandle: string
  isDisabled: boolean
  store: StoreProfile
  title: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [seoTitle, setSeoTitle] = useState(article.seoTitle)
  const [seoDescription, setSeoDescription] = useState(article.seoDescription)
  const [handle, setHandle] = useState(article.handle)
  const handleRef = useRef<HTMLElementTagNameMap["s-text-field"] | null>(null)
  const derivedHandle = toArticleHandle(title)
  const listingHandle = handle === "" ? derivedHandle : toArticleHandle(handle)
  const listingTitle = seoTitle === "" ? title : seoTitle
  const pathPrefix = `blogs/${blogHandle}/`
  const articleAddress = `https://${store.domain}/${pathPrefix}${listingHandle}`

  // `prefix` is a read-only property on every element, so React cannot hand it to the field the way it hands over
  // the rest. The attribute carries it instead.
  useEffect(() => {
    handleRef.current?.setAttribute("prefix", pathPrefix)
  }, [isEditing, pathPrefix])

  return (
    <s-section accessibilityLabel="Search engine listing">
      <s-stack direction="block" gap="base">
        <s-grid gridTemplateColumns="1fr auto" gap="small-100" alignItems="center">
          <s-heading>Search engine listing</s-heading>
          <s-button
            accessibilityLabel={isEditing ? "Close search engine listing fields" : "Edit search engine listing"}
            disabled={isDisabled}
            icon="edit"
            interestFor="search-listing-edit-tooltip"
            onClick={() => setIsEditing(!isEditing)}
            type="button"
            variant="tertiary"
          />
          <s-tooltip id="search-listing-edit-tooltip">Edit</s-tooltip>
        </s-grid>
        <s-stack direction="block" gap="small-500">
          <span className="article-listing-store">{store.name}</span>
          {/* The address is written the way a search result shows it, so the chevrons stand in for the path slashes. */}
          <span className="article-listing-url">{`https://${store.domain} › blogs › ${blogHandle} › ${listingHandle}`}</span>
          <span className="article-listing-title">{listingTitle === "" ? "Add a title" : listingTitle}</span>
          {seoDescription === "" ? null : <s-text color="subdued">{seoDescription}</s-text>}
        </s-stack>
        {isEditing ? (
          <s-stack direction="block" gap="base">
            <s-divider />
            <s-text-field
              details={`${listingTitle.length} of ${SEO_TITLE_LIMIT} characters used`}
              disabled={isDisabled}
              label="Page title"
              name="seoTitle"
              onInput={(event) => setSeoTitle(event.currentTarget.value)}
              placeholder={title}
              value={article.seoTitle}
            />
            <s-text-area
              details={`${seoDescription.length} of ${SEO_DESCRIPTION_LIMIT} characters used`}
              disabled={isDisabled}
              label="Meta description"
              name="seoDescription"
              onInput={(event) => setSeoDescription(event.currentTarget.value)}
              rows={4}
              value={article.seoDescription}
            />
            <s-text-field
              details={articleAddress}
              disabled={isDisabled}
              label="URL handle"
              name="handle"
              onInput={(event) => setHandle(event.currentTarget.value)}
              placeholder={derivedHandle}
              ref={handleRef}
              value={article.handle}
            />
            {article.shopifyArticleUrl === null || handle === article.handle ? null : (
              <s-banner tone="warning">
                Changing the address sends readers who saved the old one to the new page.
              </s-banner>
            )}
          </s-stack>
        ) : null}
      </s-stack>
    </s-section>
  )
}

/** One labelled fact about the publication, aligned into a column so the panel reads as a summary rather than loose text. */
function PublishingDetail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <s-grid gridTemplateColumns="auto auto" justifyContent="space-between" gap="small" alignItems="center">
      <s-text color="subdued">{label}</s-text>
      {children}
    </s-grid>
  )
}

/**
 * The admin's own save bar, which takes over the top of the window while there is unsaved work.
 * The element belongs to App Bridge and the admin paints the bar from it, so it stays mounted for the life of the
 * page and is only asked to show and hide. Taking the element away instead would leave the painted bar behind.
 */
function ContextualSaveBar({
  isDirty,
  isSaving,
  onDiscard,
  onSave
}: {
  isDirty: boolean
  isSaving: boolean
  onDiscard: () => void
  onSave: () => void
}) {
  const barRef = useRef<SaveBarElement | null>(null)
  const saveButtonRef = useRef<HTMLButtonElement | null>(null)
  const discardButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const bar = barRef.current
    let isActive = true
    function sync() {
      if (!isActive) {
        return
      }
      if (isDirty) {
        void bar?.show?.()
      } else {
        void bar?.hide?.()
      }
    }
    // The element only answers once the admin has defined it, so the state is applied again when that happens.
    sync()
    void customElements.whenDefined("ui-save-bar").then(sync)
    return () => {
      isActive = false
    }
  }, [isDirty])

  // The admin paints its own Save and Discard buttons at the top of the window and replays the press on these
  // elements from outside this component's tree, where React's delegated handlers never see it. Listening on the
  // elements themselves catches the press wherever it comes from.
  useEffect(() => {
    const saveButton = saveButtonRef.current
    const discardButton = discardButtonRef.current
    function handleSave() {
      onSave()
    }
    function handleDiscard() {
      onDiscard()
    }
    saveButton?.addEventListener("click", handleSave)
    discardButton?.addEventListener("click", handleDiscard)
    return () => {
      saveButton?.removeEventListener("click", handleSave)
      discardButton?.removeEventListener("click", handleDiscard)
    }
  }, [onDiscard, onSave])

  return (
    <ui-save-bar id={SAVE_BAR_ID} ref={barRef}>
      {/* The admin redraws these buttons itself and takes their labels from the text below. */}
      <button {...saveBarPrimaryAction} disabled={isSaving} ref={saveButtonRef} type="button">
        Save
      </button>
      <button disabled={isSaving} ref={discardButtonRef} type="button">
        Discard
      </button>
    </ui-save-bar>
  )
}

function DiffText({ part }: { part: DiffPart }) {
  if (part.change === "added") {
    return <ins>{part.value}</ins>
  }
  if (part.change === "removed") {
    return <del>{part.value}</del>
  }
  return <span>{part.value}</span>
}

/** Shows what restoring a version would change, so the choice is made on the content instead of a timestamp. */
function VersionDiffModal({
  currentRevisionId,
  isBusy,
  version,
  workingCopy
}: {
  currentRevisionId: string | null
  isBusy: boolean
  version: ArticleVersion | null
  workingCopy: VersionContent
}) {
  const submit = useSubmit()
  const changedFields = version === null ? [] : diffVersions(workingCopy, version).filter((field) => field.hasChanges)

  return (
    <s-modal id={VERSION_MODAL_ID} heading={version === null ? "Version" : `Version ${version.revisionNumber}`}>
      <s-stack direction="block" gap="base">
        {version === null ? null : (
          <s-text color="subdued">
            {REVISION_ORIGIN_LABELS[version.origin]} {formatTimestamp(version.createdAt)}
          </s-text>
        )}
        {version !== null && changedFields.length === 0 ? (
          <s-text color="subdued">This version matches your working copy.</s-text>
        ) : null}
        {version?.hasPublicationHistory === true ? (
          <s-text color="subdued">This version went to Shopify, so it stays in history.</s-text>
        ) : null}
        {changedFields.map((field) => (
          <s-stack direction="block" gap="small-100" key={field.field}>
            <s-text type="strong">{field.field}</s-text>
            <p className="version-diff">
              {field.parts.map((part, index) => (
                <DiffText key={`${field.field}-${index}`} part={part} />
              ))}
            </p>
          </s-stack>
        ))}
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={isBusy || version === null}
        command="--hide"
        commandFor={VERSION_MODAL_ID}
        onClick={() => {
          if (version !== null) {
            submit(
              {
                intent: "restoreRevision",
                revisionId: version.revisionId,
                expectedRevisionId: currentRevisionId ?? ""
              },
              { method: "post" }
            )
          }
        }}
      >
        Restore this version
      </s-button>
      <s-button slot="secondary-actions" command="--hide" commandFor={VERSION_MODAL_ID}>
        Close
      </s-button>
      <s-button
        slot="secondary-actions"
        tone="critical"
        type="button"
        disabled={isBusy || version === null || version.hasPublicationHistory}
        command="--hide"
        commandFor={VERSION_MODAL_ID}
        onClick={() => {
          if (version !== null) {
            submit({ intent: "deleteRevision", revisionId: version.revisionId }, { method: "post" })
          }
        }}
      >
        Delete version
      </s-button>
    </s-modal>
  )
}

function VersionHistory({
  currentRevisionId,
  isBusy,
  totalVersionCount,
  versions,
  workingCopy
}: {
  currentRevisionId: string | null
  isBusy: boolean
  totalVersionCount: number
  versions: ArticleVersion[]
  workingCopy: VersionContent
}) {
  const [selected, setSelected] = useState<ArticleVersion | null>(null)

  if (versions.length === 0) {
    return <s-text color="subdued">This article has no saved versions yet.</s-text>
  }

  return (
    <s-stack direction="block" gap="small">
      {versions.map((version) => (
        <s-box background="base" border="base" borderRadius="base" key={version.revisionId} padding="small">
          <s-stack direction="block" gap="small-100">
            <s-stack direction="inline" gap="small-100" alignItems="center">
              <s-text type="strong">Version {version.revisionNumber}</s-text>
              {version.isCurrent ? <s-badge tone="info">Working copy</s-badge> : null}
              {version.isPublished ? <s-badge tone="success">Live</s-badge> : null}
            </s-stack>
            <s-text color="subdued">
              {REVISION_ORIGIN_LABELS[version.origin]} {formatTimestamp(version.createdAt)}
            </s-text>
            {version.isCurrent ? null : (
              <s-button
                accessibilityLabel={`View version ${version.revisionNumber}`}
                command="--show"
                commandFor={VERSION_MODAL_ID}
                disabled={isBusy}
                onClick={() => setSelected(version)}
                variant="secondary"
              >
                View
              </s-button>
            )}
          </s-stack>
        </s-box>
      ))}
      {versions.length < totalVersionCount ? (
        <s-link href="?versions=all">Show all {totalVersionCount} versions</s-link>
      ) : null}
      <VersionDiffModal
        currentRevisionId={currentRevisionId}
        isBusy={isBusy}
        version={selected}
        workingCopy={workingCopy}
      />
    </s-stack>
  )
}

export function ArticleDetailPage({
  article,
  versions,
  workingCopy,
  totalVersionCount,
  destinationBlogs,
  store,
  authorSuggestions,
  linkableDestinations,
  actionResult
}: ArticleDetailPageProps) {
  const navigation = useNavigation()
  const submit = useSubmit()
  const formRef = useRef<HTMLFormElement | null>(null)
  const hasInteracted = useRef(false)
  const [contentEditRevision, setContentEditRevision] = useState<string | null>(null)
  const [fieldEditRevision, setFieldEditRevision] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const [title, setTitle] = useState(article.title)
  // Which fields hold text a workflow wrote. Like the edits above, they are held against the revision they were
  // written on, so a save leaves them behind and a reload in between does not.
  const [aiWrites, setAiWrites] = useState<{ revision: string; fields: ReadonlySet<string> }>({
    revision: article.currentRevisionId ?? article.articleId,
    fields: NO_AI_FIELDS
  })

  // Edits are remembered against the revision they were made on, so a finished save leaves them behind on its own.
  const revisionKey = article.currentRevisionId ?? article.articleId
  const isDirty = contentEditRevision === revisionKey || fieldEditRevision === revisionKey
  const aiFields = aiWrites.revision === revisionKey ? aiWrites.fields : NO_AI_FIELDS
  const isBusy = navigation.state !== "idle"
  // Resolved in an effect so the server and the first client render agree, then corrected once the width is known.
  const isNarrowViewport = useMediaQuery(NARROW_VIEWPORT, false) === true
  const crosslinks = article.recommendations.filter(({ objective }) => objective === "commercial_crosslink")
  const furtherReading = article.recommendations.filter(({ objective }) => objective === "further_reading")
  // The saved suggestions are reloaded with the page, so they say what the run that just finished actually produced.
  const suggestionCounts = { refreshCrosslinks: crosslinks.length, refreshFurtherReading: furtherReading.length }
  const refreshedIntent = actionResult?.ok === true ? actionResult.intent : ""
  const isPublished = article.publishedRevisionId !== null
  const hasUnpublishedChanges = isPublished && article.publishedRevisionId !== article.currentRevisionId
  const canWriteToShopify = article.destinationBlogGid !== null || destinationBlogs.length > 0
  const selectedBlogGid = article.destinationBlogGid ?? destinationBlogs[0]?.blogGid ?? ""
  const selectedBlogHandle =
    destinationBlogs.find((blog) => blog.blogGid === selectedBlogGid)?.handle ?? DEFAULT_BLOG_HANDLE
  const publishLabel = hasUnpublishedChanges ? "Publish latest changes" : "Publish to blog"

  // Tags, the image, and the editors carry their value in hidden fields that raise no event, so they report edits
  // directly. The editors settle their markup as they start up, so only a change after a real gesture counts.
  function markDirty() {
    if (hasInteracted.current) {
      setContentEditRevision(revisionKey)
    }
  }

  /** Remembers that a workflow, rather than the merchant, wrote what is now in a field. */
  function markAiWritten(field: string) {
    setAiWrites((current) => {
      const fields = current.revision === revisionKey ? current.fields : NO_AI_FIELDS
      if (fields.has(field)) {
        return current
      }
      return { revision: revisionKey, fields: new Set(fields).add(field) }
    })
  }

  // The visible fields are custom elements that announce their starting value as they mount, and a mounted field is
  // not an edit. Reading the form back and comparing it with the saved article tells the two apart.
  useEffect(() => {
    const form = formRef.current
    if (form === null) {
      return
    }
    // A freshly saved article re-mounts the editors, and the markup they settle on is not an edit.
    hasInteracted.current = false
    const savedValues = {
      title: article.title,
      tags: article.tags.join(","),
      author: article.author,
      handle: article.handle,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      imageUrl: article.imageUrl ?? "",
      imageAltText: article.imageAltText,
      destinationBlogGid: selectedBlogGid
    }
    const startInteraction = () => {
      hasInteracted.current = true
    }
    const compareWithSaved = () => {
      const values = new FormData(form)
      const hasEdit = Object.entries(savedValues).some(([name, saved]) => {
        const current = values.get(name)
        return typeof current === "string" && current !== saved
      })
      setFieldEditRevision(hasEdit ? revisionKey : null)
    }
    form.addEventListener("pointerdown", startInteraction, true)
    form.addEventListener("keydown", startInteraction, true)
    form.addEventListener("input", compareWithSaved)
    form.addEventListener("change", compareWithSaved)
    return () => {
      form.removeEventListener("pointerdown", startInteraction, true)
      form.removeEventListener("keydown", startInteraction, true)
      form.removeEventListener("input", compareWithSaved)
      form.removeEventListener("change", compareWithSaved)
    }
  }, [article, revisionKey, selectedBlogGid])

  function discardChanges() {
    formRef.current?.reset()
    setTitle(article.title)
    setContentEditRevision(null)
    setFieldEditRevision(null)
    setAiWrites({ revision: revisionKey, fields: NO_AI_FIELDS })
    // Rebuilding the fields makes the editors settle on their saved markup again, which is not an edit either.
    hasInteracted.current = false
    setGeneration((current) => current + 1)
  }

  return (
    <s-page heading={article.title} inlineSize="large">
      <s-link href="/app/articles" slot="breadcrumb-actions">
        Blog posts
      </s-link>
      {isNarrowViewport ? null : (
        <s-badge slot="accessory" tone={STATUS_TONES[article.status]}>
          {STATUS_LABELS[article.status]}
        </s-badge>
      )}
      {/* Preview opens the live post, so it stays disabled until a published version exists on the online store. */}
      {isPublished && article.shopifyArticleUrl !== null ? (
        <s-button href={article.shopifyArticleUrl} slot="secondary-actions" target="_blank">
          Preview
        </s-button>
      ) : (
        <s-button disabled slot="secondary-actions" type="button">
          Preview
        </s-button>
      )}
      <s-button commandFor={ACTIONS_MENU_ID} slot="secondary-actions" type="button">
        More actions
      </s-button>
      <s-menu accessibilityLabel="More actions" id={ACTIONS_MENU_ID}>
        <s-button icon="wand" onClick={() => submit({ intent: "regenerateArticle" }, { method: "post" })} type="button">
          Write this post again
        </s-button>
        <s-button command="--show" commandFor={DELETE_MODAL_ID} icon="delete" tone="critical" type="button">
          Delete blog post
        </s-button>
      </s-menu>

      <ContextualSaveBar
        isDirty={isDirty}
        isSaving={isBusy}
        onDiscard={discardChanges}
        onSave={() => formRef.current?.requestSubmit()}
      />
      <Form id={ARTICLE_FORM_ID} method="post" ref={formRef}>
        <input name="intent" type="hidden" value="saveArticle" />
        <input name="expectedRevisionId" type="hidden" value={article.currentRevisionId ?? ""} />
        <s-grid gap="base" gridTemplateColumns={isNarrowViewport ? STACKED_COLUMNS : WIDE_COLUMNS} key={generation}>
          <s-stack direction="block" gap="base">
            <s-section accessibilityLabel="Blog post">
              <s-stack direction="block" gap="base">
                {isNarrowViewport ? (
                  <s-stack direction="inline">
                    <s-badge tone={STATUS_TONES[article.status]}>{STATUS_LABELS[article.status]}</s-badge>
                  </s-stack>
                ) : null}
                <ActionBanner actionResult={actionResult} suggestionCounts={suggestionCounts} />
                <TitleField
                  initialTitle={article.title}
                  isAiWritten={aiFields.has("title")}
                  isDisabled={isBusy}
                  onAiWrite={() => markAiWritten("title")}
                  onChange={setTitle}
                />
                <s-stack direction="block" gap="small-500">
                  <span className="article-field-label">Content</span>
                  <ArticleEditor
                    accessibilityLabel="Article content"
                    defaultValue={article.content}
                    isDisabled={isBusy}
                    key={article.currentRevisionId ?? article.articleId}
                    name="body"
                    onChange={markDirty}
                    rewriteSelection={rewriteEditorText}
                    searchResources={searchLinkableResources}
                    pickImage={pickEditorImage}
                  />
                </s-stack>
              </s-stack>
            </s-section>

            <s-section heading="Excerpt">
              <s-stack direction="block" gap="small-100">
                <s-text color="subdued">Add a summary of the post to appear on your home page or blog.</s-text>
                <ArticleEditor
                  accessibilityLabel="Excerpt"
                  defaultValue={article.excerpt}
                  isDisabled={isBusy}
                  key={`excerpt-${article.currentRevisionId ?? article.articleId}`}
                  name="excerpt"
                  onChange={markDirty}
                  rewriteSelection={rewriteEditorText}
                  searchResources={searchLinkableResources}
                  pickImage={pickEditorImage}
                  size="compact"
                />
              </s-stack>
            </s-section>

            <SearchListingSection
              article={article}
              blogHandle={selectedBlogHandle}
              isDisabled={isBusy}
              store={store}
              title={title}
            />
          </s-stack>

          <s-stack direction="block" gap="base">
            <s-section heading="Publishing">
              <s-stack direction="block" gap="base">
                <s-stack direction="block" gap="small-100">
                  {hasUnpublishedChanges ? (
                    <s-stack direction="inline" gap="small-100" alignItems="center">
                      <s-badge tone="caution">Unpublished changes</s-badge>
                    </s-stack>
                  ) : null}
                  <s-text color="subdued">{getPublishingSummary(isPublished, hasUnpublishedChanges)}</s-text>
                </s-stack>

                <s-divider />

                <s-stack direction="block" gap="small-100">
                  <PublishingDetail label="Last saved">
                    <s-text>{formatTimestamp(article.updatedAt)}</s-text>
                  </PublishingDetail>
                  {article.shopifyArticleUrl === null ? null : (
                    <PublishingDetail label="Online store">
                      <s-link href={article.shopifyArticleUrl} target="_blank">
                        View article
                      </s-link>
                    </PublishingDetail>
                  )}
                </s-stack>

                {canWriteToShopify ? null : (
                  <s-banner tone="warning">
                    Synchronize your store from Settings so this article has a blog to publish to.
                  </s-banner>
                )}

                <s-divider />

                <s-stack direction="block" gap="small-100">
                  <s-button
                    disabled={!canWriteToShopify || isBusy}
                    inlineSize="fill"
                    onClick={() =>
                      submit({ destinationBlogGid: selectedBlogGid, intent: "publishArticle" }, { method: "post" })
                    }
                    type="button"
                    variant="primary"
                  >
                    {publishLabel}
                  </s-button>
                  {isPublished ? (
                    <s-button
                      disabled={isBusy}
                      inlineSize="fill"
                      onClick={() => submit({ intent: "unpublishArticle" }, { method: "post" })}
                      tone="critical"
                      type="button"
                      variant="tertiary"
                    >
                      Hide from online store
                    </s-button>
                  ) : null}
                </s-stack>
              </s-stack>
            </s-section>

            <ImageSection
              initialAltText={article.imageAltText}
              initialImageUrl={article.imageUrl}
              isAiWritten={aiFields.has("image")}
              isDisabled={isBusy}
              onAiWrite={() => markAiWritten("image")}
              onChange={markDirty}
              title={title}
            />

            <CollapsibleSection heading="Organization" isInitiallyExpanded>
              <s-stack direction="block" gap="base">
                <AuthorField initialAuthor={article.author} isDisabled={isBusy} suggestions={authorSuggestions} />
                <s-select
                  disabled={isBusy || destinationBlogs.length === 0}
                  label="Blog"
                  name="destinationBlogGid"
                  value={selectedBlogGid}
                >
                  {destinationBlogs.map((blog) => (
                    <s-option key={blog.blogGid} value={blog.blogGid}>
                      {blog.title}
                    </s-option>
                  ))}
                </s-select>
                <TagField initialTags={article.tags} isDisabled={isBusy} onChange={markDirty} />
              </s-stack>
            </CollapsibleSection>

            <SuggestionSection
              description="Products and collections that fit this article. Adding one keeps it in the next generated draft."
              emptyMessage={getSuggestionEmptyMessage(
                {
                  noDestinations:
                    "Publish a product or collection to your online store, then ask for suggestions. Only live pages can be linked.",
                  noMatch: "No published products or collections matched this article.",
                  notAsked: "No storefront links have been suggested yet."
                },
                linkableDestinations.commercial,
                refreshedIntent === "refreshCrosslinks"
              )}
              heading="Storefront links"
              isBusy={isBusy}
              recommendations={crosslinks}
              refreshIntent="refreshCrosslinks"
              refreshLabel="Suggest storefront links"
            />

            <SuggestionSection
              description="Other blog posts that give readers somewhere to go next."
              emptyMessage={getSuggestionEmptyMessage(
                {
                  noDestinations:
                    "Publish another blog post to your online store, then ask for suggestions. Only live pages can be linked.",
                  noMatch: "No other published blog posts matched this article.",
                  notAsked: "No further reading has been suggested yet."
                },
                linkableDestinations.reading,
                refreshedIntent === "refreshFurtherReading"
              )}
              heading="Further reading"
              isBusy={isBusy}
              recommendations={furtherReading}
              refreshIntent="refreshFurtherReading"
              refreshLabel="Suggest further reading"
            />

            <CollapsibleSection heading="Version history">
              <VersionHistory
                currentRevisionId={article.currentRevisionId}
                isBusy={isBusy}
                totalVersionCount={totalVersionCount}
                versions={versions}
                workingCopy={workingCopy}
              />
            </CollapsibleSection>
          </s-stack>
        </s-grid>
      </Form>

      <s-modal heading="Delete blog post?" id={DELETE_MODAL_ID}>
        <s-paragraph>
          {article.shopifyArticleGid === null
            ? `Deleting "${article.title}" removes it and every saved version. This can't be undone.`
            : `Deleting "${article.title}" removes it from your online store, along with every saved version. This can't be undone.`}
        </s-paragraph>
        <s-button
          command="--hide"
          commandFor={DELETE_MODAL_ID}
          disabled={isBusy}
          onClick={() => submit({ intent: "deleteArticle" }, { method: "post" })}
          slot="primary-action"
          tone="critical"
          type="button"
          variant="primary"
        >
          Delete blog post
        </s-button>
        <s-button command="--hide" commandFor={DELETE_MODAL_ID} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  )
}

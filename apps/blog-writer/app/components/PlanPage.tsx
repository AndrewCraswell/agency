import type { CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Fragment, useState } from "react"
import { useNavigation, useSubmit } from "react-router"
import type { BlogWorkspace } from "../persistence/blog-workspace-repository.server"
import { BACKLOG_DROPPABLE_ID, DAY_DROPPABLE_PREFIX, planBacklogInsertion, planDrop } from "./planDragState"
import "./PlanPage.css"
import type { ActionResult } from "./WorkflowForm"
import { WorkflowForm } from "./WorkflowForm"

export type PlanPageProps = {
  ideas: BlogWorkspace["ideas"]
  actionResult: ActionResult
}

export const IDEA_TYPE_VALUES = [
  "any",
  "how-to",
  "buying-guide",
  "comparison",
  "best-list",
  "problem-solution",
  "explainer",
  "care-guide",
  "sizing-guide",
  "checklist",
  "beginner-guide",
  "advanced-guide",
  "faq",
  "trend-update",
  "seasonal-guide",
  "gift-guide",
  "research-post",
  "announcement"
] as const

export const IDEA_TYPE_LABELS: Record<(typeof IDEA_TYPE_VALUES)[number], string> = {
  any: "Any format",
  "how-to": "How-to guide",
  "buying-guide": "Buying guide",
  comparison: "Product comparison",
  "best-list": "Best-of list",
  "problem-solution": "Problem and solution",
  explainer: "Educational explainer",
  "care-guide": "Product care guide",
  "sizing-guide": "Sizing and fit guide",
  checklist: "Checklist",
  "beginner-guide": "Beginner guide",
  "advanced-guide": "Advanced guide",
  faq: "FAQ",
  "trend-update": "Trend or news update",
  "seasonal-guide": "Seasonal or occasion guide",
  "gift-guide": "Gift guide",
  "research-post": "Research and data post",
  announcement: "Product launch or announcement"
}

/** Sent to the idea generator so the model writes to the shape of the format instead of guessing from its name. */
export const IDEA_TYPE_BRIEFS: Record<(typeof IDEA_TYPE_VALUES)[number], string> = {
  any: "Any editorial format that fits the topic. Choose whichever shape serves the reader best.",
  "how-to":
    "Step-by-step instructions that take a reader from a starting point to a finished result, with the gear and skills each step needs.",
  "buying-guide":
    "Helps a reader choose what to buy by explaining the decisions that matter, the trade-offs behind each one, and who each option suits.",
  comparison:
    "Puts two or more specific options side by side on the criteria buyers actually weigh, and says plainly who should pick which.",
  "best-list":
    "A short, curated set of picks for a defined use case, each with the reason it earns its place and the reader it is for.",
  "problem-solution":
    "Names a frustration the reader already has, explains what causes it, and works through the fixes from cheapest to most involved.",
  explainer:
    "Teaches one concept, material, or spec properly so the reader can make better decisions without needing an expert.",
  "care-guide":
    "How to maintain, clean, store, and repair a product so it lasts, including the mistakes that quietly shorten its life.",
  "sizing-guide":
    "How to measure, what the size charts really mean, and how fit should feel, including the common fit problems and their fixes.",
  checklist:
    "A scannable list the reader can work through before an event, trip, purchase, or season, with a line on why each item is on it.",
  "beginner-guide":
    "Orients someone brand new to the category: the vocabulary, what to buy first, what to skip, and what to expect early on.",
  "advanced-guide":
    "For readers who already know the basics. Goes into technique, tuning, or specification detail that a beginner post would skip.",
  faq: "Answers the real questions customers ask, one question per section, each answered directly in the first sentence.",
  "trend-update":
    "Reports something new in the category and explains what it changes for the reader, not just that it happened.",
  "seasonal-guide": "Tied to a time of year or occasion, covering what to prepare, what to buy, and when to do it.",
  "gift-guide": "Gift picks organised by recipient, budget, or occasion, each with the reason it lands well.",
  "research-post":
    "Builds an argument on original data, survey results, or gathered evidence, with the method stated and the numbers shown.",
  announcement:
    "Introduces a new product or change, covering what it is, who it is for, what it replaces, and where to get it."
}

// Shopify resource types a crosslink can point at; the icon carries the type so the chip label stays the title.
const RESOURCE_TYPE_ICONS = {
  product: "product",
  collection: "collection",
  page: "page",
  blog: "blog",
  article: "blog"
} as const

const RESOURCE_TYPE_LABELS = {
  product: "Product",
  collection: "Collection",
  page: "Page",
  blog: "Blog",
  article: "Article"
} as const

type ResourceType = keyof typeof RESOURCE_TYPE_ICONS

// Keywords are the search terms an idea targets, so they carry the search icon rather than a resource icon.
const KEYWORD_ICON = "search"

// A crosslink or further-reading suggestion, resolved to the storefront resource it points at.
type PlanLink = {
  title: string
  resourceType: ResourceType
  url: string
}

type PlanIdea = {
  id: string
  title: string
  date: string | null
  brief: string
  keywords: string[]
  crosslinks: PlanLink[]
  furtherReading: PlanLink[]
  workspaceIdea: BlogWorkspace["ideas"][number]
}

type IdeaEdits = Pick<PlanIdea, "brief" | "keywords" | "date">

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

// Read at render time rather than at import, so a tab left open overnight still knows which days are closed.
function getTodayKey() {
  const now = new Date()
  return toDateKey(now.getFullYear(), now.getMonth(), now.getDate())
}

function formatScheduledDate(dateKey: string | null) {
  if (dateKey === null) {
    return "Not scheduled"
  }
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(year!, month! - 1, day!))
}

function formatKeyword(keyword: string) {
  return `${keyword.slice(0, 1).toLocaleUpperCase()}${keyword.slice(1)}`
}

function toSlug(value: string) {
  return value
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

function PlanLinkChip({ ideaId, link }: { ideaId: string; link: PlanLink }) {
  const tooltipId = `link-${ideaId}-${toSlug(link.title)}`
  const label = `${link.title} (${RESOURCE_TYPE_LABELS[link.resourceType]})`
  return (
    <Fragment>
      <s-clickable-chip href={link.url} accessibilityLabel={label} interestFor={tooltipId}>
        <s-icon slot="graphic" type={RESOURCE_TYPE_ICONS[link.resourceType]} />
        {link.title}
      </s-clickable-chip>
      <s-tooltip id={tooltipId}>{label}</s-tooltip>
    </Fragment>
  )
}

const TODAY = new Date()

// Each post is written on the morning of its day, so today's run has already gone by the time the merchant looks.
const CLOSED_DAY_WARNING = {
  heading: "Pick a later day",
  body: "Each post is written on the morning of the day it is set for, so today and the days behind it are closed. Pick a day after today."
}

// Pointer collisions keep small day cells reachable; the closest centre covers gaps between them.
const detectCollisions: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args)
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args)
}

// 1 January 2024 was a Monday, so this builds Monday-first weekday names.
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, dayOffset) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(2024, 0, 1 + dayOffset))
)

function getIdeaModalId(ideaId: string) {
  return `idea-${ideaId}`
}

function getMonthDays(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const leadingCount = (firstOfMonth.getDay() + 6) % 7
  const trailingCount = 6 - ((lastOfMonth.getDay() + 6) % 7)
  const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })

  return {
    label: new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(firstOfMonth),
    days: Array.from({ length: leadingCount + lastOfMonth.getDate() + trailingCount }, (_, cellOffset) => {
      const date = new Date(year, month, cellOffset + 1 - leadingCount)
      return {
        day: date.getDate(),
        dateKey: toDateKey(date.getFullYear(), date.getMonth(), date.getDate()),
        label: dayFormat.format(date),
        isInMonth: date.getMonth() === firstOfMonth.getMonth()
      }
    })
  }
}

type IdeaModalProps = {
  idea: PlanIdea
  isEditing: boolean
  onEditingChange: (ideaId: string, isEditing: boolean) => void
  onSave: (ideaId: string, edits: IdeaEdits) => void
}

function IdeaModal({ idea, isEditing, onEditingChange, onSave }: IdeaModalProps) {
  const [briefDraft, setBriefDraft] = useState(idea.brief)
  const [dateDraft, setDateDraft] = useState(idea.date)
  const [keywordDrafts, setKeywordDrafts] = useState(idea.keywords)
  const [keywordInput, setKeywordInput] = useState("")
  const [wasEditing, setWasEditing] = useState(isEditing)

  // Editing can start from the backlog card, so refresh the drafts whenever it turns on.
  if (isEditing !== wasEditing) {
    setWasEditing(isEditing)
    if (isEditing) {
      setBriefDraft(idea.brief)
      setDateDraft(idea.date)
      setKeywordDrafts(idea.keywords)
      setKeywordInput("")
    }
  }

  function addKeyword() {
    const keyword = keywordInput.trim()
    if (keyword.length > 0 && !keywordDrafts.includes(keyword)) {
      setKeywordDrafts((currentKeywords) => [...currentKeywords, keyword])
    }
    setKeywordInput("")
  }

  function saveEdits() {
    onSave(idea.id, { brief: briefDraft.trim(), keywords: keywordDrafts, date: dateDraft })
    onEditingChange(idea.id, false)
  }

  return (
    <s-modal id={getIdeaModalId(idea.id)} heading={idea.title}>
      {isEditing ? (
        <s-stack direction="block" gap="base">
          <s-text-area
            label="Brief"
            rows={4}
            value={briefDraft}
            onChange={(event) => setBriefDraft(event.currentTarget.value)}
          />
          <s-date-field
            label="Scheduled date"
            value={dateDraft ?? ""}
            onChange={(event) => setDateDraft(event.currentTarget.value === "" ? null : event.currentTarget.value)}
          />
          <s-stack direction="block" gap="small">
            <s-grid gridTemplateColumns="1fr auto" gap="small" alignItems="end">
              <s-text-field
                label="Add a keyword"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.currentTarget.value)}
              />
              <s-button accessibilityLabel={`Add keyword to ${idea.title}`} onClick={addKeyword}>
                Add
              </s-button>
            </s-grid>
            <div className="plan-idea-editor__keywords">
              <s-stack direction="inline" gap="small">
                {keywordDrafts.length === 0 ? <s-paragraph>No keywords yet.</s-paragraph> : null}
                {keywordDrafts.map((keyword) => (
                  <s-clickable-chip
                    key={keyword}
                    removable
                    onRemove={() =>
                      setKeywordDrafts((currentKeywords) => currentKeywords.filter((entry) => entry !== keyword))
                    }
                  >
                    <s-icon slot="graphic" type={KEYWORD_ICON} />
                    {formatKeyword(keyword)}
                  </s-clickable-chip>
                ))}
              </s-stack>
            </div>
          </s-stack>
        </s-stack>
      ) : (
        <s-stack direction="block" gap="base">
          <s-heading>Brief</s-heading>
          <s-paragraph>{idea.brief}</s-paragraph>
          <s-heading>Scheduled date</s-heading>
          <s-paragraph>{formatScheduledDate(idea.date)}</s-paragraph>
          <s-heading>Keywords targeted</s-heading>
          <s-stack direction="inline" gap="small">
            {idea.keywords.map((keyword) => (
              <s-chip key={keyword}>
                <s-icon slot="graphic" type={KEYWORD_ICON} />
                {formatKeyword(keyword)}
              </s-chip>
            ))}
          </s-stack>
          <s-heading>Crosslinks proposed</s-heading>
          <s-stack direction="inline" gap="small">
            {idea.crosslinks.length === 0 ? (
              <s-paragraph>Storefront links are suggested once the post is written.</s-paragraph>
            ) : null}
            {idea.crosslinks.map((crosslink) => (
              <PlanLinkChip key={crosslink.url} ideaId={idea.id} link={crosslink} />
            ))}
          </s-stack>
          <s-heading>Further reading proposed</s-heading>
          <s-stack direction="inline" gap="small">
            {idea.furtherReading.length === 0 ? (
              <s-paragraph>Further reading is suggested once the post is written.</s-paragraph>
            ) : null}
            {idea.furtherReading.map((reading) => (
              <PlanLinkChip key={reading.url} ideaId={idea.id} link={reading} />
            ))}
          </s-stack>
        </s-stack>
      )}
      {isEditing ? (
        <s-button slot="primary-action" variant="primary" accessibilityLabel={`Save ${idea.title}`} onClick={saveEdits}>
          Save
        </s-button>
      ) : (
        <s-button
          slot="primary-action"
          variant="primary"
          accessibilityLabel={`Edit ${idea.title}`}
          onClick={() => onEditingChange(idea.id, true)}
        >
          Edit
        </s-button>
      )}
      {isEditing || idea.date === null ? null : (
        <s-button
          slot="secondary-actions"
          accessibilityLabel={`Move ${idea.title} to the backlog`}
          onClick={() => onSave(idea.id, { brief: idea.brief, keywords: idea.keywords, date: null })}
        >
          Move to backlog
        </s-button>
      )}
      {isEditing ? (
        <s-button slot="secondary-actions" onClick={() => onEditingChange(idea.id, false)}>
          Cancel
        </s-button>
      ) : (
        <s-button slot="secondary-actions" commandFor={getIdeaModalId(idea.id)} command="--hide">
          Close
        </s-button>
      )}
    </s-modal>
  )
}

type EditorialCalendarProps = {
  backlogIdeas: BlogWorkspace["ideas"]
  isBusy: boolean
}

type CalendarDayProps = {
  day: { day: number; dateKey: string; label: string; isInMonth: boolean }
  ideas: PlanIdea[]
  isBlocked: boolean
  isClosed: boolean
  isToday: boolean
}

function CalendarDay({ day, ideas, isBlocked, isClosed, isToday }: CalendarDayProps) {
  const { isOver, setNodeRef } = useDroppable({ id: `${DAY_DROPPABLE_PREFIX}${day.dateKey}` })

  function getDropModifier() {
    if (!isOver) {
      return null
    }
    if (isBlocked) {
      return "editorial-calendar__day--blocked"
    }
    return "editorial-calendar__day--over"
  }

  function getLabel() {
    const parts = [day.label]
    if (isToday) {
      parts.push("today")
    }
    if (isClosed) {
      parts.push("closed for planning")
    }
    return parts.join(", ")
  }

  const modifiers = [
    day.isInMonth ? null : "editorial-calendar__day--adjacent",
    isClosed ? "editorial-calendar__day--closed" : null,
    getDropModifier()
  ].filter((modifier) => modifier !== null)
  const numberClass = isToday
    ? "editorial-calendar__day-number editorial-calendar__day-number--today"
    : "editorial-calendar__day-number"

  return (
    <section className={["editorial-calendar__day", ...modifiers].join(" ")} aria-label={getLabel()} ref={setNodeRef}>
      <span className={numberClass}>{day.day}</span>
      {ideas.map((idea) => (
        <CalendarIdeaChip idea={idea} key={idea.id} />
      ))}
    </section>
  )
}

function CalendarIdeaChip({ idea }: { idea: PlanIdea }) {
  const { isDragging, listeners, setNodeRef } = useDraggable({ id: idea.id })
  const articleId = idea.workspaceIdea?.articleId ?? null
  // Once the post is written it takes the day, so the calendar opens the post rather than the idea it grew from.
  const modalId = articleId === null ? getIdeaModalId(idea.id) : undefined

  return (
    <article
      className={
        isDragging ? "editorial-calendar__idea editorial-calendar__idea--dragging" : "editorial-calendar__idea"
      }
      ref={setNodeRef}
      {...listeners}
    >
      <s-clickable
        background="subdued"
        borderRadius="small"
        command={modalId === undefined ? undefined : "--show"}
        commandFor={modalId}
        href={articleId === null ? undefined : `/app/articles/${articleId}`}
        padding="small-500 small-400"
      >
        {idea.title}
      </s-clickable>
    </article>
  )
}

type BacklogCardProps = {
  idea: PlanIdea
  isBusy: boolean
  onEdit: (ideaId: string) => void
}

function BacklogCard({ idea, isBusy, onEdit }: BacklogCardProps) {
  const { isDragging, listeners, setNodeRef, transform, transition } = useSortable({ id: idea.id })
  const workspaceIdea = idea.workspaceIdea
  const isDrafted = workspaceIdea.status === "drafted"
  const statusLabel = isDrafted ? "Drafted" : "Ready to write"
  const statusClass = isDrafted
    ? "plan-backlog__status plan-backlog__status--drafted"
    : "plan-backlog__status plan-backlog__status--ready"

  return (
    <article
      className={isDragging ? "plan-backlog__idea plan-backlog__idea--dragging" : "plan-backlog__idea"}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...listeners}
    >
      <div className="plan-backlog__idea-head">
        <span className={statusClass}>{statusLabel}</span>
        <s-icon size="small" type="drag-handle" />
      </div>
      <s-heading>{idea.title}</s-heading>
      <p className="plan-backlog__brief">{idea.brief}</p>
      {workspaceIdea.rationale === "" ? null : (
        <p className="plan-backlog__rationale">
          {/* The space keeps the label from running into the sentence when a screen reader flattens the line. */}
          <span className="plan-backlog__rationale-label">Why this works</span> {workspaceIdea.rationale}
        </p>
      )}
      <div className="plan-backlog__tags">
        <s-stack direction="inline" gap="small">
          {idea.keywords.map((keyword) => (
            <s-chip key={keyword}>{formatKeyword(keyword)}</s-chip>
          ))}
        </s-stack>
      </div>
      <div className="plan-backlog__actions">
        <s-stack direction="inline" gap="base" justifyContent="end">
          <s-button
            accessibilityLabel={`Edit ${idea.title}`}
            command="--show"
            commandFor={getIdeaModalId(idea.id)}
            onClick={() => onEdit(idea.id)}
          >
            Edit
          </s-button>
          <WorkflowForm
            intent="dismissIdea"
            identifier={{ name: "ideaId", value: workspaceIdea.ideaId }}
            isBusy={isBusy}
          >
            <s-button type="submit" accessibilityLabel={`Remove ${idea.title} from the backlog`} tone="critical">
              Remove
            </s-button>
          </WorkflowForm>
          {isDrafted ? null : (
            <WorkflowForm
              intent="generateDraft"
              identifier={{ name: "ideaId", value: workspaceIdea.ideaId }}
              isBusy={isBusy}
            >
              <s-button type="submit" variant="primary" accessibilityLabel={`Generate draft for ${idea.title}`}>
                Generate draft
              </s-button>
            </WorkflowForm>
          )}
        </s-stack>
      </div>
    </article>
  )
}

type BacklogDropZoneProps = {
  ideas: PlanIdea[]
  isBusy: boolean
  isDragActive: boolean
  onEdit: (ideaId: string) => void
}

function BacklogDropZone({ ideas, isBusy, isDragActive, onEdit }: BacklogDropZoneProps) {
  const { setNodeRef } = useDroppable({ id: BACKLOG_DROPPABLE_ID })

  return (
    <section
      className={isDragActive ? "plan-backlog plan-backlog--active" : "plan-backlog"}
      aria-label="Idea backlog"
      ref={setNodeRef}
    >
      <SortableContext items={ideas.map((idea) => idea.id)} strategy={verticalListSortingStrategy}>
        {ideas.length === 0 ? <s-paragraph>No ideas in the backlog.</s-paragraph> : null}
        {ideas.map((idea) => (
          <BacklogCard idea={idea} isBusy={isBusy} key={idea.id} onEdit={onEdit} />
        ))}
      </SortableContext>
    </section>
  )
}

function EditorialCalendar({ backlogIdeas, isBusy }: EditorialCalendarProps) {
  const submit = useSubmit()
  // The saved day is the truth, but a drag has to land before the loader answers, so recent moves sit on top of it.
  const [pendingSchedule, setPendingSchedule] = useState<Record<string, string | null>>({})
  const [backlogOrder, setBacklogOrder] = useState<string[]>([])
  const [ideaEdits, setIdeaEdits] = useState<Record<string, Pick<PlanIdea, "brief" | "keywords">>>({})
  const [editingIdeaId, setEditingIdeaId] = useState<string | null>(null)
  const [activeIdeaId, setActiveIdeaId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [dropWarning, setDropWarning] = useState<{ heading: string; body: string } | null>(null)
  const [dragSnapshot, setDragSnapshot] = useState<{
    schedule: Record<string, string | null>
    backlogOrder: string[]
  } | null>(null)
  const [visibleMonth, setVisibleMonth] = useState({ year: TODAY.getFullYear(), month: TODAY.getMonth() })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const month = getMonthDays(visibleMonth.year, visibleMonth.month)
  const todayKey = getTodayKey()

  const ideas: PlanIdea[] = backlogIdeas
    .map((workspaceIdea) => ({
      id: workspaceIdea.ideaId,
      title: workspaceIdea.title,
      date:
        workspaceIdea.ideaId in pendingSchedule
          ? (pendingSchedule[workspaceIdea.ideaId] ?? null)
          : workspaceIdea.scheduledFor,
      brief: workspaceIdea.angle,
      keywords: [workspaceIdea.targetKeyword],
      crosslinks: [],
      furtherReading: [],
      workspaceIdea
    }))
    .map((idea) => ({ ...idea, ...ideaEdits[idea.id] }))

  const backlogEntries = ideas.filter((idea) => idea.date === null)
  const orderedBacklog = [
    ...backlogOrder.flatMap((ideaId) => backlogEntries.filter((idea) => idea.id === ideaId)),
    ...backlogEntries.filter((idea) => !backlogOrder.includes(idea.id))
  ]
  const backlogIds = orderedBacklog.map((idea) => idea.id)
  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId) ?? null

  /** A day holds one post, so the calendar reads as the publishing rhythm rather than a pile of work. */
  function findDayHolder(dateKey: string, movingIdeaId: string) {
    return ideas.find((idea) => idea.date === dateKey && idea.id !== movingIdeaId) ?? null
  }

  /** Only a day still ahead can be planned, because the morning run for anything earlier has already gone. */
  function isPlannableDay(dateKey: string) {
    return dateKey > todayKey
  }

  /** The day under the pointer that would refuse the drop, so the drag can say so before the merchant lets go. */
  function getBlockedDayKey() {
    if (activeIdeaId === null || overId === null || !overId.startsWith(DAY_DROPPABLE_PREFIX)) {
      return null
    }
    const dateKey = overId.slice(DAY_DROPPABLE_PREFIX.length)
    if (!isPlannableDay(dateKey)) {
      return dateKey
    }
    if (findDayHolder(dateKey, activeIdeaId) === null) {
      return null
    }
    return dateKey
  }

  const blockedDayKey = getBlockedDayKey()

  function scheduleIdea(ideaId: string, date: string | null) {
    setPendingSchedule((current) => ({ ...current, [ideaId]: date }))
    submit({ intent: "scheduleIdea", ideaId, scheduledFor: date ?? "" }, { method: "post" })
  }

  function shiftMonth(monthOffset: number) {
    setVisibleMonth((current) => {
      const shifted = new Date(current.year, current.month + monthOffset, 1)
      return { year: shifted.getFullYear(), month: shifted.getMonth() }
    })
  }

  function restoreSnapshot() {
    if (dragSnapshot !== null) {
      setPendingSchedule(dragSnapshot.schedule)
      setBacklogOrder(dragSnapshot.backlogOrder)
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveIdeaId(String(event.active.id))
    setDragSnapshot({ schedule: pendingSchedule, backlogOrder })
    setDropWarning(null)
  }

  // Moving the idea into the backlog mid-drag is what opens a gap where it will land.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    setOverId(over === null ? null : String(over.id))
    if (over === null) {
      return
    }

    const activeId = String(active.id)
    const insertion = planBacklogInsertion(activeId, String(over.id), backlogIds)
    if (insertion === null) {
      return
    }

    setBacklogOrder(insertion)
    setPendingSchedule((current) => ({ ...current, [activeId]: null }))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveIdeaId(null)
    setOverId(null)
    setDragSnapshot(null)

    if (over === null) {
      restoreSnapshot()
      return
    }

    const activeId = String(active.id)
    const drop = planDrop(activeId, String(over.id), backlogIds)
    if (drop.kind === "schedule") {
      if (!isPlannableDay(drop.date)) {
        restoreSnapshot()
        setDropWarning(CLOSED_DAY_WARNING)
        return
      }
      const holder = findDayHolder(drop.date, activeId)
      if (holder !== null) {
        restoreSnapshot()
        setDropWarning({
          heading: "That day is taken",
          body: `${formatScheduledDate(drop.date)} already has ${holder.title}. Pick another day, or move that post first.`
        })
        return
      }
      setBacklogOrder(drop.backlogOrder)
      scheduleIdea(activeId, drop.date)
      return
    }

    if (drop.kind === "reorder") {
      setBacklogOrder(drop.backlogOrder)
    }

    // Anything that lands outside a day sits in the backlog, so a saved day has to be given up.
    const savedDate = backlogIdeas.find((workspaceIdea) => workspaceIdea.ideaId === activeId)?.scheduledFor ?? null
    if (savedDate !== null) {
      scheduleIdea(activeId, null)
    }
  }

  function handleDragCancel() {
    setActiveIdeaId(null)
    setOverId(null)
    setDragSnapshot(null)
    restoreSnapshot()
  }

  function handleSave(ideaId: string, edits: IdeaEdits) {
    setIdeaEdits((current) => ({ ...current, [ideaId]: { brief: edits.brief, keywords: edits.keywords } }))
    if (edits.date !== null && !isPlannableDay(edits.date)) {
      setDropWarning(CLOSED_DAY_WARNING)
      return
    }
    const holder = edits.date === null ? null : findDayHolder(edits.date, ideaId)
    if (holder !== null) {
      setDropWarning({
        heading: "That day is taken",
        body: `${formatScheduledDate(edits.date)} already has ${holder.title}. Pick another day, or move that post first.`
      })
      return
    }
    setDropWarning(null)
    scheduleIdea(ideaId, edits.date)
  }

  function handleEditingChange(ideaId: string, isEditing: boolean) {
    setEditingIdeaId(isEditing ? ideaId : null)
  }

  return (
    <s-section heading="Editorial calendar">
      <DndContext
        collisionDetection={detectCollisions}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        sensors={sensors}
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
      >
        <s-stack direction="block" gap="large">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Drag an idea from the backlog onto a day to schedule it, or onto another day to reschedule it. Each day
              holds one post, and only days after today are open. Drag a scheduled idea back to the backlog to
              unschedule it. Select a scheduled idea to review its brief.
            </s-paragraph>
            {dropWarning === null ? null : (
              <s-banner tone="warning" heading={dropWarning.heading}>
                <s-paragraph>{dropWarning.body}</s-paragraph>
              </s-banner>
            )}
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-heading>{month.label}</s-heading>
              <s-stack direction="inline" gap="small">
                <s-button accessibilityLabel="Show the previous month" onClick={() => shiftMonth(-1)}>
                  Previous
                </s-button>
                <s-button accessibilityLabel="Show the next month" onClick={() => shiftMonth(1)}>
                  Next
                </s-button>
              </s-stack>
            </s-stack>
            <div className="editorial-calendar" aria-label={month.label}>
              <div className="editorial-calendar__weekdays" aria-hidden="true">
                {WEEKDAY_LABELS.map((weekday) => (
                  <span className="editorial-calendar__weekday" key={weekday}>
                    {weekday}
                  </span>
                ))}
              </div>
              <div className="editorial-calendar__grid">
                {month.days.map((day) => (
                  <CalendarDay
                    day={day}
                    ideas={ideas.filter((idea) => idea.date === day.dateKey)}
                    isBlocked={blockedDayKey === day.dateKey}
                    isClosed={!isPlannableDay(day.dateKey)}
                    isToday={day.dateKey === todayKey}
                    key={day.dateKey}
                  />
                ))}
              </div>
            </div>
          </s-stack>
          <s-stack direction="block" gap="base">
            <s-heading>Idea backlog</s-heading>
            <BacklogDropZone
              ideas={orderedBacklog}
              isBusy={isBusy}
              isDragActive={activeIdeaId !== null}
              onEdit={(ideaId) => handleEditingChange(ideaId, true)}
            />
          </s-stack>
          {ideas.map((idea) => (
            <IdeaModal
              idea={idea}
              isEditing={editingIdeaId === idea.id}
              key={idea.id}
              onEditingChange={handleEditingChange}
              onSave={handleSave}
            />
          ))}
        </s-stack>
        <DragOverlay
          className={
            blockedDayKey === null
              ? "editorial-calendar__overlay"
              : "editorial-calendar__overlay editorial-calendar__overlay--blocked"
          }
        >
          {activeIdea === null ? null : (
            <span
              className={[
                "editorial-calendar__chip",
                "editorial-calendar__chip--overlay",
                blockedDayKey === null ? null : "editorial-calendar__chip--blocked"
              ]
                .filter((modifier) => modifier !== null)
                .join(" ")}
            >
              {activeIdea.title}
            </span>
          )}
        </DragOverlay>
      </DndContext>
    </s-section>
  )
}

function getActionMessage(actionResult: ActionResult) {
  if (actionResult === null) {
    return null
  }
  if (!actionResult.ok) {
    return "That action didn't finish. Try again."
  }

  const messages: Record<string, string> = {
    generateIdeas: "3 ideas added to your backlog.",
    selectIdea: "Idea added to the backlog.",
    dismissIdea: "Idea removed.",
    generateDraft: "Draft is ready for review."
  }
  return messages[actionResult.intent] ?? "Action completed."
}

export function PlanPage({ ideas, actionResult }: PlanPageProps) {
  const navigation = useNavigation()
  const isBusy = navigation.state !== "idle"
  // Idea generation calls out to the workflow and takes a while, so the button that started it says so.
  const isGeneratingIdeas = navigation.formData?.get("intent") === "generateIdeas"
  const [focus, setFocus] = useState("")
  const actionMessage = getActionMessage(actionResult)
  const backlogIdeas = ideas.filter((idea) => idea.status === "selected" || idea.status === "drafted")

  return (
    <s-page heading="Plan">
      <s-section heading="Generate ideas">
        <s-stack direction="block" gap="base">
          <s-paragraph>Describe the audience or topic you want to cover.</s-paragraph>
          <WorkflowForm intent="generateIdeas" isBusy={isBusy}>
            <s-stack direction="block" gap="base">
              <s-text-area
                label="Topic or audience"
                name="focus"
                onInput={(event) => setFocus(event.currentTarget.value)}
                rows={3}
                value={focus}
              />
              <s-box maxInlineSize="256px">
                <s-select label="Idea format" name="ideaType">
                  {IDEA_TYPE_VALUES.map((ideaType) => (
                    <s-option key={ideaType} value={ideaType}>
                      {IDEA_TYPE_LABELS[ideaType]}
                    </s-option>
                  ))}
                </s-select>
              </s-box>
              <s-button disabled={focus.trim().length < 3} type="submit" variant="primary" loading={isGeneratingIdeas}>
                Generate ideas
              </s-button>
            </s-stack>
          </WorkflowForm>
          {isGeneratingIdeas ? (
            // An output element is a live region, so the wait is announced and not just drawn.
            <output>
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-spinner size="base" accessibilityLabel="Generating ideas" />
                <s-paragraph>Writing 3 ideas for your backlog.</s-paragraph>
              </s-stack>
            </output>
          ) : null}
          {actionMessage === null || isBusy ? null : <s-paragraph>{actionMessage}</s-paragraph>}
          {actionResult?.ok && actionResult.intent === "generateDraft" && !isBusy ? (
            <s-link href="/app/articles">Review article</s-link>
          ) : null}
          <s-paragraph color="subdued">AI can make mistakes. Check important info.</s-paragraph>
        </s-stack>
      </s-section>

      <EditorialCalendar backlogIdeas={backlogIdeas} isBusy={isBusy} />
    </s-page>
  )
}

import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import Fuse from "fuse.js"
import { delay, http, HttpResponse } from "msw"
import { useRef, useState } from "react"
import { expect, waitFor, within } from "storybook/test"
import { network } from "../../../../.storybook/mocks"
import type { StagedReference } from "../chatRequest"
import { ChatComposer } from "../components/ChatComposer"
import { ChatWorkspace } from "../components/ChatWorkspace"
import type { ComposerHandle } from "../components/ComposerInput"
import { ReferencePicker } from "../components/ReferencePicker"
import { composerDraftText, textDraft, type ComposerDraft } from "../composerDraft"
import { researchSuggestionsSchema } from "../suggestions"
import { DrawerExample } from "./drawerExamples"
import { capturedCards } from "./reviewFixtures"
import * as mentionStyles from "./MentionComposerExample.css"

const meta = { title: "Conversation/Inputs", parameters: { layout: "padded" } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
const references: StagedReference[] = capturedCards
  .slice(0, 5)
  .map(({ record, resultId }) => ({ recordId: record.id, resultId, record }))
const suggestions = Promise.resolve(
  researchSuggestionsSchema.parse({
    suggestions: [
      {
        text: "Which members sponsor federal proposals to cap insulin costs for patients?",
        description: "Map sponsors and the provisions they support",
        kind: "sponsors"
      },
      {
        text: "What recorded actions have state legislatures taken on heat-pump building standards?",
        description: "Trace votes, amendments, and committee steps",
        kind: "actions"
      },
      {
        text: "How do right-to-repair proposals for farm equipment differ across U.S. states?",
        description: "Compare repair access, parts, and software terms",
        kind: "comparison"
      },
      {
        text: "What have congressional hearings examined about accessible voting technology?",
        description: "Review testimony and questions about access barriers",
        kind: "hearings"
      }
    ]
  }).suggestions
)
const loading = new Promise<never[]>(() => undefined)
const unavailable = Promise.resolve([])

const mentionRecords: StagedReference["record"][] = [
  {
    id: "design:colorado-transportation",
    kind: "organization",
    title: "House Transportation and Local Government",
    subtitle: "Colorado House, 2026 session",
    organizationSummary: { classification: "committee" },
    sourceUrl: null,
    fields: [],
    tallies: []
  },
  {
    id: "design:ana-ortega",
    kind: "person",
    title: "Rep. Ana Ortega",
    subtitle: "Colorado House, district 32",
    sourceUrl: null,
    fields: [],
    tallies: []
  },
  {
    id: "design:house-education",
    kind: "organization",
    title: "House Education and Workforce",
    subtitle: "U.S. House, 119th Congress",
    organizationSummary: { classification: "committee" },
    sourceUrl: null,
    fields: [],
    tallies: []
  },
  {
    id: "design:ana-morales",
    kind: "person",
    title: "Ana Morales",
    subtitle: "Committee staff, Colorado General Assembly",
    sourceUrl: null,
    fields: [],
    tallies: []
  },
  {
    id: "story:ocasio-cortez",
    kind: "person",
    title: "Alexandria Ocasio-Cortez",
    subtitle: "U.S. House, New York, district 14",
    sourceUrl: null,
    fields: [],
    tallies: []
  }
]
const mentionIndex = new Fuse(mentionRecords, {
  keys: [
    { name: "title", weight: 0.9 },
    { name: "subtitle", weight: 0.1 }
  ],
  threshold: 0.3,
  ignoreLocation: true,
  ignoreDiacritics: true,
  minMatchCharLength: 2
})

function MentionComposerExample({
  initialDraft = "",
  state = "ready"
}: Readonly<{ initialDraft?: string; state?: "ready" | "loading" | "failed" }>) {
  const [draft, setDraft] = useState(() => textDraft(initialDraft))
  const [sent, setSent] = useState("")
  const attempts = useRef(0)
  return (
    <div className={mentionStyles.stage}>
      <div className={mentionStyles.workspace}>
        {sent && (
          <p className={mentionStyles.sent} aria-label="Sent question">
            {sent}
          </p>
        )}
        <ChatComposer
          focusOnMount
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => {
            setSent(composerDraftText(draft))
            setDraft([])
          }}
          searchMentions={async (query, signal) => {
            signal.throwIfAborted()
            attempts.current += 1
            if (state === "loading") {
              await new Promise<void>((_resolve, reject) =>
                signal.addEventListener("abort", () => reject(signal.reason), { once: true })
              )
            }
            if (state === "failed" && attempts.current === 1) {
              throw new Error("Simulated name search failure")
            }
            return mentionIndex.search(query).map(({ item }) => ({
              resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
              recordId: item.id,
              record: item
            }))
          }}
        />
      </div>
    </div>
  )
}

function ComposerExample({
  running = false,
  withReferences = false
}: Readonly<{ running?: boolean; withReferences?: boolean }>) {
  const [draft, setDraft] = useState<ComposerDraft>([])
  const [selected, setSelected] = useState(withReferences ? references.slice(0, 2) : [])
  const [open, setOpen] = useState(false)
  const composer = useRef<ComposerHandle>(null)
  return (
    <>
      <ChatComposer
        draft={draft}
        onDraftChange={setDraft}
        onSend={() => setDraft([])}
        isRunning={running}
        onStop={() => composer.current?.focus()}
        composerRef={composer}
        references={selected}
        onRemoveReference={(id) => setSelected(selected.filter((reference) => reference.recordId !== id))}
        onReferenceRequested={() => {
          setOpen(true)
        }}
        messageHistory={[textDraft("Compare housing proposals"), textDraft("Find recorded actions")]}
      />
      {open && (
        <ReferencePicker
          initial={selected}
          available={references}
          mention={false}
          onApply={(value) => {
            setSelected(value)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
          returnFocus={() => composer.current?.focus()}
        />
      )}
    </>
  )
}
export const Composer: Story = { render: () => <ComposerExample /> }
export const ComposerWithReferences: Story = { render: () => <ComposerExample withReferences /> }
export const ComposerRunning: Story = { render: () => <ComposerExample running /> }
export const MentionAutocomplete: Story = {
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Production composer with fixture-backed name search and local submission. Uses grouped people and committee suggestions, debounced lookup, and exact inline identities. No model calls."
      }
    }
  },
  render: () => <MentionComposerExample initialDraft="Compare proposals from @house" />
}
export const MentionPeople: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="What has @Ocasio" />
}
export const MentionFirstName: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="What has @Alexandria" />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Alexandria Ocasio-Cortez/ })
    ).toBeVisible()
  }
}
export const MentionFuzzySearch: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="What has @Ocassio" />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("option", { name: /Alexandria Ocasio-Cortez/ })
    ).toBeVisible()
  }
}
export const MentionCommittees: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="Find hearings from @education" />
}
export const MentionNoResults: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="Find @zzzz" />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByText("No matching people or committees.")
    ).toBeVisible()
  }
}
export const MentionLoading: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="Ask @Ocasio" state="loading" />,
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByText("Searching people and committees...")
    ).toBeVisible()
  }
}
export const MentionSearchFailed: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample initialDraft="Ask @Ocasio" state="failed" />,
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement.ownerDocument.body).findByRole("alert")).toHaveTextContent(
      "People and committees could not be loaded."
    )
  }
}
export const MentionSelected: Story = {
  ...MentionAutocomplete,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(await canvas.findByRole("option", { name: /House Transportation and Local Government/ }))
    await expect(canvas.getByRole("textbox", { name: "Your question" })).toHaveTextContent(
      "Compare proposals from @House Transportation and Local Government"
    )
    await expect(canvas.getByRole("textbox").querySelector('[data-type="mention"]')).toHaveAttribute(
      "contenteditable",
      "false"
    )
    await expect(canvas.getByRole("textbox", { name: "Your question" })).toHaveFocus()
    await expect(canvas.queryByRole("listbox")).not.toBeInTheDocument()
  }
}
export const MentionKeyboard: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const input = await canvas.findByRole("textbox", { name: "Your question" })
    await userEvent.type(input, "Ask @ana")
    await canvas.findByRole("option", { name: /Ana Morales/ })
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: /Rep. Ana Ortega/ })).toHaveAttribute("aria-selected", "true")
    )
    await userEvent.keyboard("{Enter}")
    await expect(input).toHaveTextContent("Ask @Rep. Ana Ortega")
    await expect(input).toHaveFocus()
    await expect(canvas.queryByLabelText("Sent question")).not.toBeInTheDocument()
    await expect(input.querySelector('[data-type="mention"]')).toHaveAttribute("data-label", "Rep. Ana Ortega")
  }
}
export const MentionDismissed: Story = {
  ...MentionAutocomplete,
  render: () => <MentionComposerExample />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const input = await canvas.findByRole("textbox", { name: "Your question" })
    await userEvent.type(input, "Ask @ana")
    await userEvent.keyboard("{Escape}")
    await expect(input).toHaveTextContent("Ask @ana")
    await expect(canvas.queryByRole("listbox")).not.toBeInTheDocument()
  }
}
export const Suggestions: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <ChatWorkspace suggestions={suggestions} isAvailable />,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const question = "Which members sponsor federal proposals to cap insulin costs for patients?"
    await userEvent.click(await canvas.findByRole("button", { name: question }))
    await expect(canvas.getByRole("textbox", { name: "Your question" })).toHaveTextContent(question)
    await expect(canvas.getByRole("textbox", { name: "Your question" })).toHaveFocus()
  }
}
export const SuggestionsLoading: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <ChatWorkspace suggestions={loading} isAvailable />
}
export const SuggestionsUnavailable: Story = {
  parameters: { layout: "fullscreen" },
  render: () => <ChatWorkspace suggestions={unavailable} isAvailable />
}
export const ReferenceLibrary: Story = {
  render: () => (
    <DrawerExample label="Add references">
      {({ isOpen, onClose, returnFocus }) =>
        isOpen && (
          <ReferencePicker
            initial={[]}
            available={references}
            mention={false}
            onApply={onClose}
            onClose={onClose}
            returnFocus={returnFocus}
          />
        )
      }
    </DrawerExample>
  )
}
function referenceResponse(state: "empty" | "failed" | "loading") {
  return () => {
    network.use(
      http.post("*/chat", async () => {
        if (state === "loading") {
          await delay("infinite")
        }
        return HttpResponse.json(
          state === "empty" ? { references: [] } : { error: "Simulated reference search failure" },
          { status: state === "failed" ? 503 : 200 }
        )
      })
    )
    return () => network.resetHandlers()
  }
}
const search: NonNullable<Story["play"]> = async ({ canvasElement, userEvent }) => {
  await userEvent.type(
    within(canvasElement.ownerDocument.body).getByRole("textbox", { name: "Search references" }),
    "housing"
  )
}
export const ReferenceSearchEmpty: Story = {
  render: ReferenceLibrary.render,
  beforeEach: referenceResponse("empty"),
  play: async (context) => {
    await search(context)
    await expect(
      await within(context.canvasElement.ownerDocument.body).findByText("No matching references.")
    ).toBeVisible()
  }
}
export const ReferenceSearchFailed: Story = {
  render: ReferenceLibrary.render,
  beforeEach: referenceResponse("failed"),
  play: async (context) => {
    await search(context)
    await expect(
      await within(context.canvasElement.ownerDocument.body).findByText("References could not be loaded. Try again.")
    ).toBeVisible()
  }
}
export const ReferenceSearchLoading: Story = {
  render: ReferenceLibrary.render,
  beforeEach: referenceResponse("loading"),
  play: async (context) => {
    await search(context)
    await expect(
      await within(context.canvasElement.ownerDocument.body).findByText("Searching references...")
    ).toBeVisible()
  }
}

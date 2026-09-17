import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { UIMessage } from "ai"
import { expect, within } from "storybook/test"
import type { StagedReference } from "../chatRequest"
import { MessageQuestion, MessageReferences } from "../components/MessageReferences"
import { composerDraftText, composerMessageMetadata, textDraft, type ComposerDraft } from "../composerDraft"
import * as responseStyles from "../components/ConversationResponse.css"

const person: StagedReference = {
  resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
  recordId: "design:dana-whitfield",
  record: {
    id: "design:dana-whitfield",
    kind: "person",
    title: "Rep. Dana Whitfield",
    sourceUrl: null,
    fields: [],
    tallies: []
  }
}
const committee: StagedReference = {
  resultId: person.resultId,
  recordId: "design:local-government",
  record: {
    id: "design:local-government",
    kind: "organization",
    title: "Local Government and Housing",
    sourceUrl: null,
    fields: [],
    tallies: []
  }
}
const longCommittee: StagedReference = {
  ...committee,
  recordId: "design:long-committee",
  record: {
    ...committee.record,
    id: "design:long-committee",
    title: "Subcommittee on Transportation, Housing and Urban Development, and Related Agencies"
  }
}
function question(draft: ComposerDraft, references: StagedReference[] = []): UIMessage {
  return {
    id: "sent-question",
    role: "user",
    parts: [{ type: "text", text: composerDraftText(draft) }],
    metadata: composerMessageMetadata(draft, references)
  }
}

function SentQuestion({ message }: Readonly<{ message: UIMessage }>) {
  return (
    <article aria-label="Your question" className={responseStyles.questionBubble}>
      <MessageReferences message={message} />
      <MessageQuestion message={message} />
    </article>
  )
}

const meta = {
  title: "Conversation/Sent tags",
  component: SentQuestion,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Production sent-question rendering using design fixtures. Inline tags retain record identity but display an icon and published name, without the typed @ trigger."
      }
    }
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof SentQuestion>
export default meta
type Story = StoryObj<typeof meta>

export const Person: Story = {
  args: {
    message: question([
      ...textDraft("How did "),
      { type: "mention", reference: person },
      ...textDraft(" vote this session?")
    ])
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(person.record.title).querySelector("svg")).toHaveClass("lucide-user-round")
    await expect(canvas.getByRole("article")).not.toHaveTextContent("@")
    await expect(canvas.queryByRole("list", { name: "Submitted references" })).not.toBeInTheDocument()
  }
}
export const Committee: Story = {
  args: {
    message: question([
      ...textDraft("What is before "),
      { type: "mention", reference: committee },
      ...textDraft(" this session?")
    ])
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText(committee.record.title).querySelector("svg")).toHaveClass(
      "lucide-landmark"
    )
  }
}
export const PersonAndCommittee: Story = {
  args: {
    message: question([
      ...textDraft("How did "),
      { type: "mention", reference: person },
      ...textDraft(" vote in "),
      { type: "mention", reference: committee },
      ...textDraft(" this session?")
    ])
  }
}
export const RepeatedPerson: Story = {
  args: {
    message: question([
      { type: "mention", reference: person },
      ...textDraft(" sponsored the bill. How did "),
      { type: "mention", reference: person },
      ...textDraft(" vote?")
    ])
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText(person.record.title)).toHaveLength(2)
  }
}
export const LongName: Story = {
  args: {
    message: question([
      ...textDraft("Summarize hearings held by "),
      { type: "mention", reference: longCommittee },
      ...textDraft(" this session.")
    ])
  }
}
export const Narrow: Story = {
  args: PersonAndCommittee.args,
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 288 }}>
        <Story />
      </div>
    )
  ]
}
export const LongNameNarrow: Story = {
  args: LongName.args,
  decorators: Narrow.decorators
}
export const PlainTypedName: Story = {
  args: { message: question(textDraft("What did @Rep. Dana Whitfield propose?")) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-type="mention"]')).toBeNull()
    await expect(within(canvasElement).getByRole("article")).toHaveTextContent("@Rep. Dana Whitfield")
  }
}
export const SeparateReference: Story = {
  args: {
    message: question([...textDraft("Compare proposals from "), { type: "mention", reference: person }], [committee])
  },
  play: async ({ canvasElement }) => {
    const references = within(canvasElement).getByRole("list", { name: "Submitted references" })
    await expect(references).toHaveTextContent(committee.record.title)
    await expect(references).not.toHaveTextContent(person.record.title)
  }
}

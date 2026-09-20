"use client"

import type { UIMessage } from "ai"
import { useRef, useState } from "react"
import { StickToBottom } from "use-stick-to-bottom"
import type { CitationSelection } from "../../conversations/components/citationPresentation"
import { ConversationResponse } from "../../conversations/components/ConversationResponse"
import { RecordCard, recordActionUnavailable } from "../../conversations/components/EntityResults"
import { EvidencePanel } from "../../conversations/components/EvidencePanel"
import { MessageQuestion } from "../../conversations/components/MessageReferences"
import { presentationBlockSchema } from "../../conversations/composition"
import type { EntityCard } from "../../conversations/entityResults"
import type { EvidenceSnapshot } from "../../conversations/evidence"
import { HomepageWorkflows } from "./HomepageWorkflows"
import * as conversationStyles from "../../conversations/components/ConversationResponse.css"
import * as styles from "./HomepageLanding.css"

const bill: EntityCard = {
  id: "bill:ca:20232024:ab:2652",
  kind: "bill",
  title: "AB 2652 State Department of Education: artificial intelligence working group.",
  identifier: "AB 2652",
  subtitle: "2023-2024",
  metadata: ["California", "2023-2024"],
  sourceUrl: "http://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2652",
  billSummary: {
    sessionId: "session:ca:20232024",
    sessionName: "2023-2024",
    status: "Referred to committee",
    latestAction: { description: "In committee: Held under submission.", date: "2024-05-16" }
  },
  fields: [
    { id: "introduced", label: "Introduced", value: "2024-02-14" },
    { id: "versions", label: "Versions", value: "4" }
  ],
  tallies: []
}

const quote =
  "This bill would require the Superintendent, in consultation with the State Board of Education, to convene a working group, composed as provided, for specific purposes related to artificial intelligence in public schools, as specified."
const sourceUrl =
  "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202320240AB2652&version=20230AB265297AMD"
const evidence: EvidenceSnapshot = {
  id: "bill:ca:20232024:ab:2652:document:771ee9be4ef47c237a0fb3f9:section:6b974ded6874a2918686209d",
  recordId: bill.id,
  billId: bill.id,
  title: bill.title,
  origin: "canonical",
  publisher: "California Legislature",
  versionLabel: "Amended in Assembly, April 18, 2024",
  locator: "Legislative counsel's digest, page 1",
  sourceUrl,
  content: { state: "available", quote }
}

const question: UIMessage = {
  id: "homepage-question",
  role: "user",
  parts: [{ type: "text", text: "What would California AB 2652 do about artificial intelligence in public schools?" }]
}
const passage = presentationBlockSchema.parse({
  state: "ready",
  blockId: "homepage-passage",
  records: [],
  content: {
    id: "33333333-3333-4333-8333-333333333333",
    kind: "evidence",
    evidence: { ...evidence, citationRef: "e1" }
  },
  spec: {
    root: "passage",
    elements: {
      passage: { type: "CitationCard", props: { contentId: "33333333-3333-4333-8333-333333333333" }, children: [] }
    }
  }
})
const answer: UIMessage = {
  id: "homepage-answer",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "AB 2652, as amended in the Assembly on April 18, 2024, would require the Superintendent to convene a working group on artificial intelligence in public schools, in consultation with the State Board of Education. [1](#citation-e1)\n\nThis describes a proposal in that filed version, not a statement of current law."
    },
    { type: "data-presentation", id: passage.blockId, data: passage }
  ]
}

export function HomepageProof() {
  const [selection, setSelection] = useState<CitationSelection>()
  const returnTarget = useRef<HTMLElement | null>(null)
  function openEvidence(target: HTMLElement) {
    returnTarget.current = target
    setSelection({ answerId: answer.id, number: 1, evidence })
  }
  function selectEvidence(citation: CitationSelection) {
    returnTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSelection(citation)
  }
  return (
    <>
      <section id="example-answer" tabIndex={-1} aria-labelledby="example-title" className={styles.band}>
        <div className={styles.inner}>
          <header className={styles.sectionHead}>
            <p className={styles.eyebrow}>One answer, end to end</p>
            <h2 id="example-title" className={styles.sectionTitle}>
              See what supports the answer.
            </h2>
            <p className={styles.sectionDescription}>
              This answer cites California AB 2652 as amended on April 18, 2024. The quoted passage and source version
              let you check the claim. It describes a proposal, not current law.
            </p>
          </header>
          <div className={styles.proof}>
            <div className={styles.answer}>
              <div className={conversationStyles.questionTurn}>
                <div className={conversationStyles.questionHead}>
                  <span className={conversationStyles.questionAuthor}>You</span>
                </div>
                <article aria-label="Example question" className={conversationStyles.questionBubble}>
                  <MessageQuestion message={question} />
                </article>
              </div>
              <StickToBottom initial={false} resize="instant">
                <ConversationResponse
                  message={answer}
                  isRunning={false}
                  isIncomplete={false}
                  onEvidence={selectEvidence}
                />
              </StickToBottom>
            </div>
            <aside className={styles.rail} aria-label="The source record">
              <p className={styles.eyebrow}>The record it came from</p>
              <RecordCard record={bill} resultId="homepage-example" onOpenVote={recordActionUnavailable} />
            </aside>
          </div>
        </div>
      </section>
      <HomepageWorkflows quote={quote} sourceUrl={sourceUrl} onRead={openEvidence} />
      <EvidencePanel
        selection={selection}
        onClose={() => setSelection(undefined)}
        returnFocus={() => returnTarget.current?.focus()}
      />
    </>
  )
}

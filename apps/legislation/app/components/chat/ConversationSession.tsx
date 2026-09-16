"use client"

import { Chat, useChat } from "@ai-sdk/react"
import { useDebouncedValue } from "@mantine/hooks"
import { captureException } from "@sentry/nextjs"
import { DefaultChatTransport, type UIMessage } from "ai"
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react"
import invariant from "tiny-invariant"
import { z } from "zod"
import {
  conversationTextMessages,
  referenceMessageMetadata,
  conversationReferenceSchema,
  stagedReferenceSchema,
  type StagedReference
} from "../../lib/chatRequest"
import { clarificationResponseSchema, type ClarificationResponse } from "../../lib/clarification"
import {
  developmentConversationKey,
  parseDevelopmentConversation,
  type DevelopmentConversation
} from "../../lib/developmentConversation"
import { entityPageSchema, ResultExpiredError, type EntityPage } from "../../lib/entityResults"
import { acknowledgeMessage } from "../../lib/messageTime"
import {
  meetingDetailsSchema,
  profileDetailsSchema,
  voteDetailsSchema,
  type MeetingDetails,
  type ProfileDetails,
  type VoteDetails
} from "../../lib/recordDetails"

function createChatSession(snapshot?: DevelopmentConversation, ownerKey?: string) {
  const sessionKey = snapshot?.sessionKey ?? ownerKey ?? crypto.randomUUID()
  const transport = new DefaultChatTransport({
    api: "/chat",
    prepareSendMessagesRequest: ({ messages, body }) => {
      const metadata = z
        .object({ references: z.array(conversationReferenceSchema).max(12) })
        .safeParse(messages.findLast((message) => message.role === "user")?.metadata)
      return {
        body: {
          ...body,
          references: metadata.success ? metadata.data.references : [],
          sessionKey,
          messages: conversationTextMessages(messages)
        }
      }
    }
  })
  const chat: Chat<UIMessage> = new Chat<UIMessage>({
    id: snapshot?.id,
    messages: snapshot?.messages,
    transport,
    onData: (part) => {
      if (part.type === "data-message-accepted") {
        chat.messages = acknowledgeMessage(chat.messages, part.data)
      }
    },
    onError: (error) => {
      captureException(error, { tags: { operation: "chat_transport" } })
    }
  })
  return { chat, sessionKey }
}

type ConversationSessionValue = Readonly<{
  chat: Chat<UIMessage>
  startConversation: (text: string) => string
  answerClarification: (response: ClarificationResponse, text: string) => Promise<void>
  clarificationAnswers: Record<string, ClarificationResponse>
  isConfirmingClarification: boolean
  cancelClarification: () => void
  draft: string
  setDraft: (draft: string) => void
  references: StagedReference[]
  setReferences: (references: StagedReference[]) => void
  searchReferences: (query: string, kind: string, signal: AbortSignal) => Promise<StagedReference[]>
  isRestoringConversation: boolean
  hasReloadRecoveryError: boolean
  interruptedMessageId: string | undefined
  markInterrupted: () => void
  loadResultPage: (resultId: string, page: number, signal: AbortSignal) => Promise<EntityPage>
  loadVoteDetails: (resultId: string, recordId: string, signal: AbortSignal) => Promise<VoteDetails>
  loadMeetingDetails: (resultId: string, recordId: string, signal: AbortSignal) => Promise<MeetingDetails>
  loadProfileDetails: (
    resultId: string,
    recordId: string,
    signal: AbortSignal,
    cursor?: string,
    parentRecordId?: string
  ) => Promise<ProfileDetails>
  meetingSelection: { resultId: string; recordId: string } | undefined
  setMeetingSelection: (selection: { resultId: string; recordId: string } | undefined) => void
}>

const ConversationSessionContext = createContext<ConversationSessionValue | undefined>(undefined)
type ConversationSessionProps = Readonly<{ children: ReactNode }>

export function ConversationSession({ children }: ConversationSessionProps) {
  const [session, setSession] = useState(createChatSession)
  const [clarificationAnswers, setClarificationAnswers] = useState<Record<string, ClarificationResponse>>({})
  const [isConfirmingClarification, setIsConfirmingClarification] = useState(false)
  const [draft, setDraft] = useState("")
  const [references, setReferences] = useState<StagedReference[]>([])
  const [meetingSelection, setMeetingSelection] = useState<{ resultId: string; recordId: string }>()
  const [isRestoringConversation, setIsRestoringConversation] = useState(process.env.NODE_ENV === "development")
  const [hasReloadRecoveryError, setHasReloadRecoveryError] = useState(false)
  const [interruptedMessageId, setInterruptedMessageId] = useState<string>()
  const hasRestoredConversation = useRef(false)
  const answerRequest = useRef<AbortController | null>(null)
  const { chat } = session
  const { messages, status, setMessages } = useChat({ chat })
  const [checkpointMessages] = useDebouncedValue(messages, 250)
  const [checkpointDraft] = useDebouncedValue(draft, 250)

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || hasRestoredConversation.current) {
      return
    }
    let isCancelled = false
    async function restore() {
      try {
        const serialized = sessionStorage.getItem(developmentConversationKey)
        const snapshot = serialized ? await parseDevelopmentConversation(serialized) : undefined
        if (isCancelled) {
          return
        }
        if (snapshot) {
          setSession(createChatSession(snapshot))
          setDraft(snapshot.draft)
          setReferences(snapshot.references ?? [])
          setClarificationAnswers(snapshot.clarificationAnswers)
          setInterruptedMessageId(snapshot.interruptedMessageId)
        } else if (serialized) {
          sessionStorage.removeItem(developmentConversationKey)
        }
      } catch (error) {
        if (!isCancelled) {
          captureException(error)
          setHasReloadRecoveryError(true)
        }
      } finally {
        if (!isCancelled) {
          hasRestoredConversation.current = true
          setIsRestoringConversation(false)
        }
      }
    }
    void restore()
    return () => {
      isCancelled = true
    }
  }, [])

  const persistConversation = useEffectEvent(() => {
    const wasInterrupted =
      chat.status === "submitted" || chat.status === "streaming" || chat.status === "error" || isConfirmingClarification
    const snapshot: DevelopmentConversation = {
      id: chat.id,
      sessionKey: session.sessionKey,
      messages: chat.messages,
      draft,
      references,
      clarificationAnswers,
      interruptedMessageId: wasInterrupted ? chat.messages.at(-1)?.id : interruptedMessageId
    }
    try {
      sessionStorage.setItem(developmentConversationKey, JSON.stringify(snapshot))
      setHasReloadRecoveryError(false)
    } catch (error) {
      if (!hasReloadRecoveryError) {
        captureException(error)
      }
      setHasReloadRecoveryError(true)
      try {
        sessionStorage.removeItem(developmentConversationKey)
      } catch {
        return
      }
    }
  })

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || isRestoringConversation) {
      return
    }
    const checkpoint = window.setTimeout(() => persistConversation(), 0)
    const onPageHide = () => persistConversation()
    window.addEventListener("pagehide", onPageHide)
    return () => {
      window.clearTimeout(checkpoint)
      window.removeEventListener("pagehide", onPageHide)
    }
  }, [
    session,
    checkpointMessages,
    checkpointDraft,
    references,
    status,
    clarificationAnswers,
    isConfirmingClarification,
    interruptedMessageId,
    isRestoringConversation
  ])

  useEffect(() => () => answerRequest.current?.abort(), [])

  function cancelClarification() {
    answerRequest.current?.abort()
  }

  function markInterrupted() {
    setInterruptedMessageId(chat.messages.at(-1)?.id)
  }

  async function loadResultPage(resultId: string, page: number, signal: AbortSignal) {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({ action: "page-results", sessionKey: session.sessionKey, resultId, page })
    })
    if (response.status === 410) {
      throw new ResultExpiredError()
    }
    if (!response.ok) {
      throw new Error("This page could not be loaded. Previously loaded results are unchanged.")
    }
    const next = entityPageSchema.parse(await response.json())
    const isExhaustedContinuation = next.page === page - 1 && !next.hasNext
    if (next.id !== resultId || (next.page !== page && !isExhaustedContinuation)) {
      throw new Error("The result page did not match this request.")
    }
    signal.throwIfAborted()
    setMessages((messages) =>
      messages.map((message) => ({
        ...message,
        parts: message.parts.map((part) => {
          if (part.type !== "dynamic-tool" || part.state !== "output-available") {
            return part
          }
          const output = z.looseObject({ resultSet: entityPageSchema }).safeParse(part.output)
          if (!output.success || output.data.resultSet.id !== resultId) {
            return part
          }
          return { ...part, output: { ...output.data, resultSet: next } }
        })
      }))
    )
    return next
  }

  async function loadVoteDetails(resultId: string, recordId: string, signal: AbortSignal) {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({ action: "inspect-record", sessionKey: session.sessionKey, resultId, recordId })
    })
    if (response.status === 410) {
      throw new ResultExpiredError()
    }
    if (!response.ok) {
      throw new Error("Vote details could not be loaded. Try again.")
    }
    const details = voteDetailsSchema.parse(await response.json())
    signal.throwIfAborted()
    if (details.record.id !== recordId || details.record.kind !== "vote") {
      throw new Error("Vote details did not match this record.")
    }
    return details
  }

  async function loadMeetingDetails(resultId: string, recordId: string, signal: AbortSignal) {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({ action: "inspect-record", sessionKey: session.sessionKey, resultId, recordId })
    })
    if (response.status === 410) {
      throw new ResultExpiredError()
    }
    if (!response.ok) {
      throw new Error("Meeting details could not be loaded.")
    }
    const details = meetingDetailsSchema.parse(await response.json())
    signal.throwIfAborted()
    if (details.record.id !== recordId || details.record.kind !== "meeting") {
      throw new Error("Meeting detail identity mismatch")
    }
    return details
  }

  async function loadProfileDetails(
    resultId: string,
    recordId: string,
    signal: AbortSignal,
    cursor?: string,
    parentRecordId?: string
  ) {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({
        action: "inspect-record",
        sessionKey: session.sessionKey,
        resultId,
        recordId,
        cursor,
        parentRecordId
      })
    })
    if (response.status === 410) {
      throw new ResultExpiredError()
    }
    if (!response.ok) {
      throw new Error("Record details could not be loaded.")
    }
    const details = profileDetailsSchema.parse(await response.json())
    signal.throwIfAborted()
    if (details.record.id !== recordId) {
      throw new Error("Record detail identity mismatch")
    }
    return details
  }

  function startConversation(text: string) {
    setMeetingSelection(undefined)
    cancelClarification()
    void chat.stop()
    const nextSession = createChatSession(undefined, references.length > 0 ? session.sessionKey : undefined)
    setSession(nextSession)
    setClarificationAnswers({})
    setDraft("")
    setInterruptedMessageId(undefined)
    void nextSession.chat.sendMessage({
      text,
      metadata: referenceMessageMetadata(references)
    })
    return nextSession.chat.id
  }

  async function answerClarification(response: ClarificationResponse, text: string) {
    if (answerRequest.current || chat.status === "submitted" || chat.status === "streaming") {
      throw new Error("Another response is in progress")
    }
    const controller = new AbortController()
    answerRequest.current = controller
    setIsConfirmingClarification(true)
    try {
      const result = await fetch("/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ action: "answer-clarification", sessionKey: session.sessionKey, response })
      })
      if (!result.ok) {
        if (result.status >= 500) {
          captureException(new Error("Clarification confirmation failed"), {
            tags: { operation: "clarification_submit" }
          })
        }
        throw new Error("Clarification was not confirmed")
      }
      const payload: unknown = await result.json()
      const accepted = clarificationResponseSchema.parse(
        payload !== null && typeof payload === "object" && "response" in payload ? payload.response : undefined
      )
      controller.signal.throwIfAborted()
      if (accepted.requestId !== response.requestId || accepted.revision !== response.revision) {
        throw new Error("Clarification confirmation did not match the question")
      }
      setClarificationAnswers((answers) => ({ ...answers, [accepted.requestId]: accepted }))
      const originalReferences = z
        .object({ references: z.array(conversationReferenceSchema).max(12) })
        .safeParse(chat.messages.findLast((message) => message.role === "user")?.metadata)
      void chat.sendMessage(
        {
          text,
          metadata: {
            clarificationRequestId: accepted.requestId,
            references: originalReferences.success ? originalReferences.data.references : []
          }
        },
        { body: { clarificationId: accepted.requestId } }
      )
    } catch (error) {
      if (
        !controller.signal.aborted &&
        !(error instanceof Error && error.message === "Clarification was not confirmed")
      ) {
        captureException(error, { tags: { operation: "clarification_submit" } })
      }
      throw error
    } finally {
      if (answerRequest.current === controller) {
        answerRequest.current = null
        setIsConfirmingClarification(false)
      }
    }
  }

  async function searchReferences(query: string, kind: string, signal: AbortSignal) {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal,
      body: JSON.stringify({ action: "search-references", sessionKey: session.sessionKey, query, kind })
    })
    if (!response.ok) {
      throw new Error("References could not be loaded. Try again.")
    }
    return z.object({ references: z.array(stagedReferenceSchema).max(35) }).parse(await response.json()).references
  }

  return (
    <ConversationSessionContext
      value={{
        chat,
        startConversation,
        answerClarification,
        clarificationAnswers,
        isConfirmingClarification,
        cancelClarification,
        draft,
        setDraft,
        references,
        setReferences,
        searchReferences,
        isRestoringConversation,
        hasReloadRecoveryError,
        interruptedMessageId,
        markInterrupted,
        loadResultPage,
        loadVoteDetails,
        loadMeetingDetails,
        loadProfileDetails,
        meetingSelection,
        setMeetingSelection
      }}
    >
      {children}
    </ConversationSessionContext>
  )
}

export function useConversationSession() {
  const session = useContext(ConversationSessionContext)
  invariant(session, "Conversation requires ConversationSession")
  return session
}

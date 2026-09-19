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
  conversationReferenceSchema,
  stagedReferenceSchema,
  type StagedReference
} from "../chatRequest"
import { clarificationResponseSchema, type ClarificationResponse } from "../clarification"
import { composerDraftText, composerMessageMetadata, composerReferences, type ComposerDraft } from "../composerDraft"
import {
  developmentConversationKey,
  parseDevelopmentConversation,
  type DevelopmentConversation
} from "../developmentConversation"
import { entityPageSchema, ResultExpiredError, type EntityPage } from "../entityResults"
import { acknowledgeMessage } from "../messageTime"
import {
  meetingDetailsSchema,
  profileDetailsSchema,
  voteDetailsSchema,
  type MeetingDetails,
  type ProfileDetails,
  type VoteDetails
} from "../recordDetails"
import { messageResponseOutcome, responseIsIncomplete } from "../responseOutcome"

function createChatSession(snapshot?: DevelopmentConversation, ownerKey?: string) {
  const sessionKey = snapshot?.sessionKey ?? ownerKey ?? crypto.randomUUID()
  let isExplicitlyCancelled = false
  const transport = new DefaultChatTransport({
    api: "/chat",
    prepareSendMessagesRequest: ({ id, messages, body }) => {
      isExplicitlyCancelled = false
      const metadata = z
        .object({ references: z.array(conversationReferenceSchema).max(12) })
        .safeParse(messages.findLast((message) => message.role === "user")?.metadata)
      return {
        body: {
          ...body,
          references: metadata.success ? metadata.data.references : [],
          sessionKey,
          sessionId: id,
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
    onFinish: ({ message, isAbort, isError, isDisconnect, finishReason }) => {
      chat.messages = chat.messages.map((current) => {
        if (current.id !== message.id) {
          return current
        }
        const metadata = z.record(z.string(), z.unknown()).safeParse(current.metadata)
        const previous = z
          .object({ isCancelled: z.boolean() })
          .safeParse(metadata.success ? metadata.data.responseObservation : undefined)
        return {
          ...current,
          metadata: {
            ...(metadata.success ? metadata.data : {}),
            responseObservation: {
              finishReason: finishReason ?? null,
              isAbort,
              isError,
              isDisconnect,
              isCancelled: isExplicitlyCancelled || (previous.success && previous.data.isCancelled)
            }
          }
        }
      })
    },
    onError: (error) => {
      captureException(error, { tags: { operation: "chat_transport", sessionId: chat.id } })
    }
  })
  return {
    chat,
    sessionKey,
    markCancelled: () => {
      isExplicitlyCancelled = true
    }
  }
}

type ConversationSessionValue = Readonly<{
  chat: Chat<UIMessage>
  startConversation: (draft: ComposerDraft) => string
  answerClarification: (response: ClarificationResponse, text: string) => Promise<void>
  clarificationAnswers: Record<string, ClarificationResponse>
  isConfirmingClarification: boolean
  cancelClarification: () => void
  draft: ComposerDraft
  setDraft: (draft: ComposerDraft) => void
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
  const [draft, setDraft] = useState<ComposerDraft>([])
  const [references, setReferences] = useState<StagedReference[]>([])
  const [meetingSelection, setMeetingSelection] = useState<{ resultId: string; recordId: string }>()
  const [isRestoringConversation, setIsRestoringConversation] = useState(process.env.NODE_ENV === "development")
  const [hasReloadRecoveryError, setHasReloadRecoveryError] = useState(false)
  const [interruptedMessageId, setInterruptedMessageId] = useState<string>()
  const hasRestoredConversation = useRef(false)
  const answerRequest = useRef<AbortController | null>(null)
  const { chat } = session
  const { messages, status, setMessages } = useChat({ chat, throttle: 50 })
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
    const lastMessage = chat.messages.at(-1)
    const hasTerminalAnswer =
      lastMessage?.role === "assistant" && !responseIsIncomplete(messageResponseOutcome(lastMessage))
    const wasInterrupted =
      !hasTerminalAnswer &&
      (chat.status === "submitted" ||
        chat.status === "streaming" ||
        chat.status === "error" ||
        isConfirmingClarification)
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
    session.markCancelled()
    const latest = chat.messages.at(-1)
    if (latest) {
      const metadata = z.record(z.string(), z.unknown()).safeParse(latest.metadata)
      setMessages((messages) =>
        messages.map((message) =>
          message.id === latest.id
            ? {
                ...message,
                metadata: {
                  ...(metadata.success ? metadata.data : {}),
                  responseObservation: { isCancelled: true }
                }
              }
            : message
        )
      )
    }
    setInterruptedMessageId(latest?.id)
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

  function startConversation(nextDraft: ComposerDraft) {
    setMeetingSelection(undefined)
    cancelClarification()
    void chat.stop()
    const selected = composerReferences(nextDraft, references)
    const nextSession = createChatSession(undefined, selected.length > 0 ? session.sessionKey : undefined)
    setSession(nextSession)
    setClarificationAnswers({})
    setDraft([])
    setInterruptedMessageId(undefined)
    void nextSession.chat.sendMessage({
      text: composerDraftText(nextDraft),
      metadata: composerMessageMetadata(nextDraft, references)
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
    const results = z
      .object({ references: z.array(stagedReferenceSchema).max(35) })
      .parse(await response.json()).references
    signal.throwIfAborted()
    return results
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

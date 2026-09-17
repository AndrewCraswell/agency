"use client"

import { useDebouncedValue } from "@mantine/hooks"
import { useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { Input } from "../../../components/ui/input"
import type { StagedReference } from "../../conversations/chatRequest"
import { useConversationSession } from "../../conversations/components/ConversationSession"
import { MentionSuggestions } from "../../conversations/components/MentionSuggestions"
import { composerReferences } from "../../conversations/composerDraft"
import * as styles from "./HomepageConnections.css"

export function HomepageMentions({ onSelect }: Readonly<{ onSelect: (references: StagedReference[]) => void }>) {
  const id = useId()
  const session = useConversationSession()
  const [query, setQuery] = useState("Oca")
  const [searchQuery] = useDebouncedValue(query.trim(), 300)
  const [attempt, setAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<{ query: string; items: StagedReference[]; hasFailed: boolean }>()
  const popup = useRef<HTMLElement>(null)
  const search = useEffectEvent((text: string, signal: AbortSignal) =>
    session.searchReferences(text, "mention", signal)
  )
  useEffect(() => {
    if (searchQuery.length < 2) {
      return
    }
    const controller = new AbortController()
    void search(searchQuery, controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) {
          setResult({ query: searchQuery, items, hasFailed: false })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({ query: searchQuery, items: [], hasFailed: true })
        }
      })
    return () => controller.abort()
  }, [searchQuery, attempt])
  const isLoading = query.trim().length >= 2 && result?.query !== query.trim()
  const items = result?.query === query.trim() && query.trim().length >= 2 ? result.items : []
  const selected = composerReferences(session.draft, session.references)
  function canSelect(reference: StagedReference) {
    return (
      selected.length < 12 ||
      selected.some((item) => item.recordId === reference.recordId && item.record.kind === reference.record.kind)
    )
  }
  useEffect(() => {
    popup.current?.ownerDocument.getElementById(`${id}-${index}`)?.scrollIntoView({ block: "nearest" })
  }, [id, index])
  return (
    <MentionSuggestions
      popupRef={popup}
      className={styles.mentionPopover}
      id={id}
      query={query}
      items={items}
      activeIndex={index}
      isLoading={isLoading}
      hasFailed={result?.query === query.trim() && result.hasFailed}
      isAtLimit={selected.length >= 12}
      canSelect={canSelect}
      onSelect={(reference) => onSelect([reference])}
      onActivate={setIndex}
      onRetry={() => {
        setResult(undefined)
        setIndex(0)
        setAttempt(attempt + 1)
      }}
      queryControl={
        <Input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setIndex(0)
            setResult(undefined)
          }}
          className={styles.mentionInput}
          aria-label="Find people and committees"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          aria-activedescendant={items[index] ? `${id}-${index}` : undefined}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setIndex(items.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : 0)
            }
            if (event.key === "Enter") {
              event.preventDefault()
              const reference = items[index]
              if (reference && canSelect(reference)) {
                onSelect([reference])
              }
            }
            if (event.key === "Escape") {
              event.currentTarget.blur()
            }
          }}
        />
      }
    />
  )
}

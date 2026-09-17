"use client"

import { AtSign, Landmark, RotateCcw, User } from "lucide-react"
import type { ReactNode, Ref } from "react"
import { Button } from "../../../components/ui/button"
import { Skeleton } from "../../../components/ui/skeleton"
import { cn } from "../../../components/ui/utils"
import type { StagedReference } from "../chatRequest"
import * as styles from "./ComposerInput.css"

export function MentionSuggestions({
  id,
  query,
  items,
  activeIndex,
  isLoading,
  hasFailed,
  isAtLimit,
  canSelect,
  onSelect,
  onActivate,
  onRetry,
  popupRef,
  className,
  queryControl
}: Readonly<{
  id: string
  query: string
  items: readonly StagedReference[]
  activeIndex: number
  isLoading: boolean
  hasFailed: boolean
  isAtLimit: boolean
  canSelect: (reference: StagedReference) => boolean
  onSelect: (reference: StagedReference) => void
  onActivate: (index: number) => void
  onRetry: () => void
  popupRef?: Ref<HTMLElement>
  className?: string
  queryControl?: ReactNode
}>) {
  const isInitialQuery = query.trim().length < 2
  const hasSkeletons = isInitialQuery || isLoading
  return (
    <section ref={popupRef} className={cn(styles.picker, className)} aria-label="People and committees">
      <div className={styles.query} aria-hidden={queryControl ? undefined : true}>
        <AtSign size={18} aria-hidden="true" />
        {queryControl ?? <span className={styles.queryText}>{query}</span>}
        {!queryControl && hasSkeletons && <span className={styles.queryLabel}>People and committees</span>}
      </div>
      {hasSkeletons && (
        <div className={styles.skeletons} aria-hidden="true" data-mention-skeletons>
          {[styles.skeletonLong, styles.skeletonShort, styles.skeletonMedium].map((width) => (
            <Skeleton key={width} className={cn(styles.skeleton, width, isInitialQuery && styles.skeletonStatic)} />
          ))}
        </div>
      )}
      <div
        id={`${id}-list`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Rich options retain focus in the multiline editor.
        role="listbox"
        aria-label="People and committees"
        aria-busy={!isInitialQuery && isLoading}
        className={styles.results}
      >
        {(["person", "organization"] as const).map((kind) => {
          const grouped = isLoading ? [] : items.filter((item) => item.record.kind === kind)
          if (grouped.length === 0) {
            return null
          }
          const label = kind === "person" ? "People" : "Committees"
          const Icon = kind === "person" ? User : Landmark
          return (
            <fieldset key={kind} className={styles.group}>
              <legend className={styles.groupHeading}>{label}</legend>
              {grouped.map((reference) => {
                const index = items.indexOf(reference)
                return (
                  <button
                    key={`${reference.record.kind}:${reference.recordId}`}
                    id={`${id}-${index}`}
                    type="button"
                    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Active-descendant options are not a standalone native select.
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-disabled={!canSelect(reference)}
                    tabIndex={-1}
                    className={styles.option}
                    onPointerDown={(event) => event.preventDefault()}
                    onPointerMove={() => onActivate(index)}
                    onClick={() => {
                      if (canSelect(reference)) {
                        onSelect(reference)
                      }
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span className={styles.identity}>
                      <span className={styles.name}>{reference.record.title}</span>
                      <span className={styles.detail}>{reference.record.subtitle}</span>
                    </span>
                    <span className={styles.kind}>{kind === "person" ? "Person" : "Committee"}</span>
                  </button>
                )
              })}
            </fieldset>
          )
        })}
      </div>
      {isInitialQuery && <output className={styles.loadingFooter}>Keep typing to narrow the list</output>}
      {!isInitialQuery && isLoading && (
        <output className={styles.loadingFooter}>Searching people and committees...</output>
      )}
      {!isInitialQuery && !isLoading && hasFailed && (
        <div className={styles.status}>
          <p role="alert">People and committees could not be loaded.</p>
          <Button type="button" variant="ghost" onPointerDown={(event) => event.preventDefault()} onClick={onRetry}>
            <RotateCcw size={16} aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}
      {!isInitialQuery && !isLoading && !hasFailed && items.length === 0 && (
        <output className={styles.status}>No matching people or committees.</output>
      )}
      {isAtLimit && <output className={styles.status}>You can add up to 12 references.</output>}
    </section>
  )
}

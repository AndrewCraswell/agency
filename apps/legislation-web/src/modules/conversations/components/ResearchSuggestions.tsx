"use client"

import { Activity, ArrowUpRight, Columns2, Gavel, Users } from "lucide-react"
import { use } from "react"
import { Suggestion } from "../../../components/ai-elements/suggestion"
import { Skeleton } from "../../../components/ui/skeleton"
import { cn } from "../../../components/ui/utils"
import type { ResearchSuggestion } from "../suggestions"
import * as styles from "./ChatWorkspace.css"

const icons = { sponsors: Users, actions: Activity, comparison: Columns2, hearings: Gavel }

export function ResearchSuggestionsLoading() {
  return (
    <output className="grid gap-2" aria-label="Loading research questions">
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className={cn(styles.suggestion, index === 3 && styles.suggestionExtra)} aria-hidden="true">
          <Skeleton className="size-[15px] shrink-0" />
          <div className={styles.suggestionCopy}>
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </output>
  )
}

export function ResearchSuggestions({
  suggestions,
  onSelect
}: Readonly<{ suggestions: Promise<ResearchSuggestion[]>; onSelect: (text: string) => void }>) {
  const items = use(suggestions)
  if (items.length === 0) {
    return null
  }
  return (
    <section aria-label="Suggested research questions" className="grid gap-2">
      {items.map(({ text, description, kind }, index) => {
        const Icon = icons[kind]
        return (
          <Suggestion
            key={text}
            suggestion={text}
            onClick={onSelect}
            aria-label={text}
            className={cn(styles.suggestion, index === 3 && styles.suggestionExtra)}
          >
            <Icon className="size-[15px] text-primary" aria-hidden="true" />
            <span className={styles.suggestionCopy}>
              <span className={styles.suggestionQuestion}>{text}</span>
              <span className={styles.suggestionDescription}>{description}</span>
            </span>
            <ArrowUpRight className="size-3.5 text-subtle" aria-hidden="true" />
          </Suggestion>
        )
      })}
    </section>
  )
}

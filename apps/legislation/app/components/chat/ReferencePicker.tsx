"use client"

import { CalendarDays, FileDiff, FileText, Gavel, Landmark, ScrollText, Search, UserRound, X } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"
import { refreshStagedReferences, type StagedReference } from "../../lib/chatRequest"
import { entityLabels } from "../../lib/entityResults"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useConversationSession } from "./ConversationSession"
import * as styles from "./ReferencePicker.css"

const icons = {
  bill: ScrollText,
  person: UserRound,
  organization: Landmark,
  meeting: CalendarDays,
  vote: Gavel,
  amendment: FileDiff,
  document: FileText,
  material: FileText
}

export function ReferencePicker({
  initial,
  available,
  mention,
  onApply,
  onClose,
  returnFocus
}: Readonly<{
  initial: StagedReference[]
  available: StagedReference[]
  mention: boolean
  onApply: (references: StagedReference[]) => void
  onClose: () => void
  returnFocus: () => void
}>) {
  const { searchReferences } = useConversationSession()
  const [selected, setSelected] = useState(initial)
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState(mention ? "person" : "all")
  const [results, setResults] = useState<StagedReference[]>([])
  const [searched, setSearched] = useState<string>()
  const [isLoading, setIsLoading] = useState(false)
  const [failure, setFailure] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const isCurrentSearch = searched === `${kind}:${query.trim()}`
  const local = new Map([...available, ...selected].map((item) => [`${item.record.kind}:${item.recordId}`, item]))
  const visible = isCurrentSearch
    ? results
    : [...local.values()].filter(
        (item) =>
          (kind === "all" || item.record.kind === kind) &&
          (!query.trim() || item.record.title.toLowerCase().includes(query.trim().toLowerCase()))
      )
  async function search() {
    if (query.trim().length < 2) {
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setIsLoading(true)
    setFailure(false)
    try {
      const next = await searchReferences(query, kind, controller.signal)
      if (!controller.signal.aborted) {
        setResults(next)
        setSelected((current) => refreshStagedReferences(current, next))
        setSearched(`${kind}:${query.trim()}`)
      }
    } catch {
      if (!controller.signal.aborted) {
        setFailure(true)
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false)
      }
    }
  }
  const searchCurrent = useEffectEvent(search)
  useEffect(() => {
    if (query.trim().length < 2) {
      return
    }
    const timer = window.setTimeout(() => void searchCurrent(), 300)
    return () => {
      window.clearTimeout(timer)
      request.current?.abort()
    }
  }, [query, kind])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        className={styles.panel}
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <div className={styles.header}>
          <DialogTitle className={styles.title}>Add references</DialogTitle>
          <DialogClose asChild>
            <Button size="icon" variant="ghost" className={styles.close} aria-label="Close reference library">
              <X className="size-[18px]" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault()
            void search()
          }}
        >
          <Search className="size-[18px] shrink-0 text-subtle" aria-hidden="true" />
          <Input
            className={styles.input}
            value={query}
            onChange={(event) => {
              request.current?.abort()
              setIsLoading(false)
              setQuery(event.target.value)
            }}
            aria-label="Search references"
            placeholder="Search references"
          />
        </form>
        <Select
          value={kind}
          onValueChange={(value) => {
            request.current?.abort()
            setIsLoading(false)
            setKind(value)
            setResults([])
            setSearched(undefined)
            setFailure(false)
          }}
        >
          <SelectTrigger aria-label="Reference type" className={styles.type}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(mention
              ? ["person", "organization"]
              : ["all", "bill", "person", "organization", "meeting", "vote", "amendment", "material"]
            ).map((value) => (
              <SelectItem key={value} value={value}>
                {
                  {
                    all: "All types",
                    meeting: "Meetings",
                    vote: "Votes",
                    bill: "Bills",
                    person: "People",
                    organization: "Organizations",
                    amendment: "Amendments",
                    material: "Materials"
                  }[value]
                }
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isLoading && <output className={styles.metadata}>Searching references...</output>}
        {failure && (
          <p role="alert" className={styles.metadata}>
            References could not be loaded. Try again.
          </p>
        )}
        <div className={styles.list} aria-busy={isLoading}>
          {visible.map((item) => {
            const Icon = icons[item.record.kind]
            const isSelected = selected.some(
              (reference) => reference.recordId === item.recordId && reference.record.kind === item.record.kind
            )
            return (
              <label key={`${item.record.kind}:${item.recordId}`} className={styles.row}>
                <Icon className="size-[15px] shrink-0 text-subtle" aria-hidden="true" />
                <span className={styles.label}>
                  {item.record.title}
                  <span className={`block ${styles.metadata}`}>{item.record.subtitle}</span>
                </span>
                <span className={styles.trailing}>{entityLabels[item.record.kind].singular}</span>
                <Checkbox
                  className={styles.selection}
                  checked={isSelected}
                  disabled={!isSelected && selected.length >= 12}
                  onCheckedChange={(checked) =>
                    setSelected((current) =>
                      checked === true
                        ? [...current, item]
                        : current.filter(
                            (reference) =>
                              reference.recordId !== item.recordId || reference.record.kind !== item.record.kind
                          )
                    )
                  }
                  aria-label={item.record.title}
                />
              </label>
            )
          })}
          {visible.length === 0 && !isLoading && (
            <p className="p-3 text-sm text-muted-foreground">No matching references.</p>
          )}
        </div>
        <div className={styles.footer}>
          <output className={`mr-auto ${styles.metadata}`}>
            {new Intl.NumberFormat().format(selected.length)} selected
          </output>
          <Button className={styles.add} disabled={selected.length === 0} onClick={() => onApply(selected)}>
            Add references
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

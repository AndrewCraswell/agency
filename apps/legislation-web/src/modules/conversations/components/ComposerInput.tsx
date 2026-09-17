"use client"

import Mention, { type MentionOptions } from "@tiptap/extension-mention"
import { PluginKey } from "@tiptap/pm/state"
import type { EditorView } from "@tiptap/pm/view"
import { Editor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { exitSuggestion, type SuggestionProps } from "@tiptap/suggestion"
import {
  useEffect,
  useEffectEvent,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref
} from "react"
import { createPortal } from "react-dom"
import type { StagedReference } from "../chatRequest"
import {
  composerDocument,
  composerDraftText,
  composerReferences,
  readComposerDraft,
  type ComposerDraft
} from "../composerDraft"
import { MentionSuggestions } from "./MentionSuggestions"
import * as styles from "./ComposerInput.css"

export type ComposerHandle = { focus: (options?: FocusOptions) => void }
type MentionAttributes = { id: string; label: string; reference: StagedReference }
type Suggestions = SuggestionProps<StagedReference, MentionAttributes>
const mentionPluginKey = new PluginKey("composerMention")
type ComposerInputProps = Readonly<{
  draft: ComposerDraft
  onDraftChange: (draft: ComposerDraft) => void
  onSend: () => void
  canSend: boolean
  isMobile: boolean
  references: readonly StagedReference[]
  messageHistory: readonly ComposerDraft[]
  searchMentions?: (query: string, signal: AbortSignal) => Promise<StagedReference[]>
  composerRef?: Ref<ComposerHandle>
  describedBy?: string
  focusOnMount?: boolean
}>

const InlineMention = Mention.extend<MentionOptions<StagedReference, MentionAttributes>>({
  parseHTML() {
    return []
  },
  addAttributes() {
    return { ...this.parent?.(), reference: { default: null, rendered: false } }
  }
})

function canSelect(reference: StagedReference, draft: ComposerDraft, staged: readonly StagedReference[]) {
  const references = composerReferences(draft, staged)
  return (
    references.length < 12 ||
    references.some((item) => item.recordId === reference.recordId && item.record.kind === reference.record.kind)
  )
}

export function ComposerInput(props: ComposerInputProps) {
  const id = useId()
  const current = useRef(props)
  useLayoutEffect(() => {
    current.current = props
  })
  const latest = useRef<Suggestions | null>(null)
  const activeIndex = useRef(0)
  const retryRequest = useRef<AbortController | null>(null)
  const [menu, setMenu] = useState<{ suggestions: Suggestions; index: number } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const history = useRef<{ index: number; draft: ComposerDraft; recalled: ComposerDraft } | null>(null)
  const receivedDraft = useRef(props.draft)
  const emittedDraft = useRef<ComposerDraft | null>(null)
  const popup = useRef<HTMLElement>(null)

  function show(suggestions: Suggestions) {
    latest.current = suggestions
    activeIndex.current = 0
    setMenu({ suggestions, index: 0 })
  }

  function choose(reference: StagedReference) {
    const suggestions = latest.current
    if (
      !suggestions ||
      suggestions.loading ||
      !canSelect(reference, current.current.draft, current.current.references)
    ) {
      return
    }
    suggestions.editor.view.focus()
    suggestions.command({ id: reference.recordId, label: reference.record.title, reference })
  }

  function handleMentionKey(event: KeyboardEvent, view: EditorView) {
    if (event.isComposing || event.keyCode === 229) {
      return false
    }
    if (event.key === "Escape") {
      exitSuggestion(view, mentionPluginKey)
      return true
    }
    const suggestions = latest.current
    if (!suggestions) {
      return false
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const reference = suggestions.items[activeIndex.current]
      if (reference) {
        choose(reference)
      }
      return true
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const count = suggestions.items.length
      const direction = event.key === "ArrowDown" ? 1 : -1
      const index = count ? (activeIndex.current + direction + count) % count : 0
      activeIndex.current = index
      setMenu({ suggestions, index })
      return true
    }
    return false
  }

  async function load(query: string, signal: AbortSignal) {
    setFailure(null)
    const search = current.current.searchMentions
    if (!search) {
      return []
    }
    try {
      const results = await search(query.trim(), signal)
      signal.throwIfAborted()
      return results
        .filter(
          (item) =>
            item.record.kind === "person" ||
            (item.record.kind === "organization" && item.record.organizationSummary?.classification === "committee")
        )
        .toSorted(
          (left, right) => Number(left.record.kind === "organization") - Number(right.record.kind === "organization")
        )
    } catch {
      if (!signal.aborted) {
        setFailure(query)
      }
      return []
    }
  }

  const [editor, setEditor] = useState<Editor | null>(null)
  const createEditor = useEffectEvent(() => {
    const extensions = [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        code: false,
        codeBlock: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
        link: false,
        underline: false
      }),
      InlineMention.configure({
        HTMLAttributes: { class: styles.tag },
        deleteTriggerWithBackspace: true,
        suggestion: {
          pluginKey: mentionPluginKey,
          placement: "top-start",
          offset: { mainAxis: 12, crossAxis: 0 },
          allowSpaces: true,
          minQueryLength: 2,
          debounce: 300,
          items: ({ query, signal }) => {
            retryRequest.current?.abort()
            if (query.trim().length > 200) {
              return []
            }
            return load(query, signal)
          },
          render: () => ({
            onBeforeStart: show,
            onBeforeUpdate: (suggestions) => show({ ...suggestions, items: [] }),
            onStart: show,
            onUpdate: show,
            onExit: () => {
              latest.current = null
              retryRequest.current?.abort()
              setMenu(null)
            },
            onKeyDown: ({ event, view }) => handleMentionKey(event, view)
          })
        }
      })
    ]
    return new Editor({
      autofocus: props.focusOnMount ? "end" : false,
      content: composerDocument(props.draft),
      extensions,
      editorProps: {
        attributes: {
          id,
          class: styles.editor,
          role: "textbox",
          "aria-label": "Your question",
          "aria-multiline": "true",
          "aria-autocomplete": "list",
          "aria-haspopup": "listbox",
          "data-placeholder": "Ask a research question..."
        },
        handleKeyDown(view, event) {
          if (event.isComposing || event.keyCode === 229) {
            return false
          }
          if (latest.current && ["Enter", "ArrowUp", "ArrowDown", "Escape"].includes(event.key)) {
            return handleMentionKey(event, view)
          }
          const input = current.current
          if (event.key === "Enter" && !event.shiftKey && !input.isMobile) {
            if (input.canSend) {
              history.current = null
              input.onSend()
            }
            return true
          }
          if (
            (event.key !== "ArrowUp" && event.key !== "ArrowDown") ||
            event.shiftKey ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey
          ) {
            return false
          }
          const position = history.current
          const isRecalling = position !== null && JSON.stringify(position.recalled) === JSON.stringify(input.draft)
          const selection = view.state.selection
          const isSelectedRecall =
            isRecalling && selection.from === 1 && selection.to === view.state.doc.content.size - 1
          if (!selection.empty && !isSelectedRecall) {
            return false
          }
          const isUp = event.key === "ArrowUp"
          if (
            composerDraftText(input.draft).includes("\n") &&
            !isSelectedRecall &&
            ((isUp && selection.from !== 1) || (!isUp && selection.to !== view.state.doc.content.size - 1))
          ) {
            return false
          }
          if (!isRecalling && (!isUp || input.messageHistory.length === 0)) {
            return false
          }
          const previous = isRecalling
            ? position
            : { index: input.messageHistory.length, draft: input.draft, recalled: input.draft }
          const index = Math.max(0, Math.min(input.messageHistory.length, previous.index + (isUp ? -1 : 1)))
          const recalled = input.messageHistory[index] ?? previous.draft
          history.current = { ...previous, index, recalled }
          input.onDraftChange(recalled)
          return true
        }
      },
      onCreate: ({ editor: created }) => setEditor(created),
      onUpdate: ({ editor: changed }) => {
        history.current = null
        const draft = readComposerDraft(changed.state.doc)
        emittedDraft.current = draft
        current.current.onDraftChange(draft)
      },
      onBlur: ({ editor: blurred }) => {
        exitSuggestion(blurred.view, mentionPluginKey)
        setMenu(null)
      }
    })
  })
  useEffect(() => {
    const instance = createEditor()
    return () => instance.destroy()
  }, [])

  useImperativeHandle(props.composerRef, () => ({ focus: (options) => editor?.view.dom.focus(options) }), [editor])
  useEffect(() => () => retryRequest.current?.abort(), [])
  const isOpen = menu !== null
  useLayoutEffect(() => {
    const suggestions = latest.current
    const element = popup.current
    if (!isOpen || !suggestions || !element) {
      return
    }
    element.style.visibility = "hidden"
    return suggestions.mount(element, {
      onPosition: ({ x, y, strategy }) => {
        const viewportWidth = element.ownerDocument.documentElement.clientWidth
        const scrollLeft = strategy === "absolute" ? (element.ownerDocument.defaultView?.scrollX ?? 0) : 0
        const left = Math.max(scrollLeft + 16, Math.min(x, scrollLeft + viewportWidth - element.offsetWidth - 16))
        Object.assign(element.style, { position: strategy, left: `${left}px`, top: `${y}px`, visibility: "visible" })
      }
    })
  }, [isOpen])
  useLayoutEffect(() => {
    const hasChanged = receivedDraft.current !== props.draft
    receivedDraft.current = props.draft
    if (!editor || editor.isDestroyed || !hasChanged || props.draft === emittedDraft.current) {
      return
    }
    editor.commands.setContent(composerDocument(props.draft), { emitUpdate: false })
    const end = editor.state.doc.content.size - 1
    editor.commands.setTextSelection(history.current ? { from: 1, to: end } : end)
  }, [editor, props.draft])
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return
    }
    const field = editor.view.dom
    const active = menu?.suggestions.items[menu.index]
    for (const [name, value] of [
      ["aria-controls", menu ? `${id}-list` : undefined],
      ["aria-activedescendant", active ? `${id}-${menu?.index}` : undefined],
      ["aria-describedby", props.describedBy]
    ]) {
      if (name && value) {
        field.setAttribute(name, value)
      } else if (name) {
        field.removeAttribute(name)
      }
    }
    if (active) {
      field.ownerDocument.getElementById(`${id}-${menu?.index}`)?.scrollIntoView({ block: "nearest" })
    }
  }, [editor, menu, id, props.describedBy])

  async function retry() {
    const suggestions = latest.current
    if (!suggestions) {
      return
    }
    retryRequest.current?.abort()
    const controller = new AbortController()
    retryRequest.current = controller
    show({ ...suggestions, items: [], loading: true })
    const items = await load(suggestions.query, controller.signal)
    if (!controller.signal.aborted && latest.current?.query === suggestions.query) {
      show({ ...suggestions, items, loading: false })
    }
  }

  const suggestions = menu?.suggestions
  return (
    <div className={styles.anchor}>
      <EditorContent editor={editor} />
      {menu &&
        suggestions &&
        editor &&
        createPortal(
          <MentionSuggestions
            popupRef={popup}
            id={id}
            query={suggestions.query}
            items={suggestions.items}
            activeIndex={menu.index}
            isLoading={suggestions.loading}
            hasFailed={failure === suggestions.query}
            isAtLimit={composerReferences(props.draft, props.references).length >= 12}
            canSelect={(reference) => canSelect(reference, props.draft, props.references)}
            onSelect={choose}
            onActivate={(index) => {
              activeIndex.current = index
              setMenu({ suggestions, index })
            }}
            onRetry={() => void retry()}
          />,
          editor.view.dom.ownerDocument.body
        )}
    </div>
  )
}

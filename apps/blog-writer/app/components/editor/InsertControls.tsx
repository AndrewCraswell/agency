import { Fragment, useId, useRef, useState } from "react"
// --- Vendored Tiptap primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { ChevronDownIcon, ImageIcon, TableIcon, VideoIcon } from "./editor-icons"

/** Resolves to the chosen image, to a message the merchant can act on, or to `null` when they close the picker. */
export type PickEditorImage = () => Promise<{ url: string; altText: string } | { error: string } | null>

export function InsertImageButton({ pickImage }: { pickImage: PickEditorImage }) {
  const { editor } = useTiptapEditor()
  const [isPicking, setIsPicking] = useState(false)

  async function insert() {
    if (editor === null) {
      return
    }
    setIsPicking(true)
    const picked = await pickImage()
    setIsPicking(false)
    if (picked === null) {
      return
    }
    if ("error" in picked) {
      shopify.toast.show(picked.error, { isError: true })
      return
    }
    editor.chain().focus().setImage({ src: picked.url, alt: picked.altText }).run()
  }

  return (
    <Button
      aria-label="Insert image"
      disabled={isPicking}
      onClick={() => void insert()}
      tooltip="Image"
      type="button"
      variant="ghost"
    >
      <ImageIcon className="tiptap-button-icon" />
    </Button>
  )
}

export function InsertEmbedModal() {
  const { editor } = useTiptapEditor()
  const modalRef = useRef<HTMLElementTagNameMap["s-modal"] | null>(null)
  const sourceRef = useRef<HTMLElementTagNameMap["s-text-area"] | null>(null)
  const [error, setError] = useState<string | null>(null)
  /* Both editors on the page render this control, so the modal id has to be unique per instance. */
  const modalId = `insert-video-${useId().replaceAll(/[^a-zA-Z0-9]/g, "")}`

  function insert() {
    if (editor === null) {
      return
    }
    const inserted = editor
      .chain()
      .focus()
      .setEmbed(sourceRef.current?.value ?? "")
      .run()
    if (!inserted) {
      setError("That snippet has no video address in it. Paste the whole embed code.")
      return
    }
    setError(null)
    if (sourceRef.current !== null) {
      sourceRef.current.value = ""
    }
    modalRef.current?.hideOverlay()
  }

  return (
    <Fragment>
      <Button
        aria-label="Insert video"
        onClick={() => modalRef.current?.showOverlay()}
        tooltip="Video"
        type="button"
        variant="ghost"
      >
        <VideoIcon className="tiptap-button-icon" />
      </Button>
      <s-modal heading="Insert video" id={modalId} ref={modalRef}>
        <s-stack direction="block" gap="base">
          <s-paragraph>Insert a video by pasting the embed snippet in the box below.</s-paragraph>
          {error === null ? null : <s-banner tone="critical">{error}</s-banner>}
          <s-text-area
            details={'The embed snippet usually starts with "<iframe ..."'}
            label="Embed snippet"
            labelAccessibilityVisibility="exclusive"
            onInput={() => setError(null)}
            ref={sourceRef}
            rows={4}
          />
        </s-stack>
        <s-button onClick={insert} slot="primary-action" variant="primary">
          Insert video
        </s-button>
        <s-button command="--hide" commandFor={modalId} slot="secondary-actions">
          Cancel
        </s-button>
      </s-modal>
    </Fragment>
  )
}

/** The table actions offered once the cursor sits inside a table, grouped the way the admin's own table menu is. */
const tableActionGroups = [
  [
    { label: "Add row above", run: "addRowBefore" },
    { label: "Add row below", run: "addRowAfter" },
    { label: "Add column left", run: "addColumnBefore" },
    { label: "Add column right", run: "addColumnAfter" }
  ],
  [
    { label: "Toggle header row", run: "toggleHeaderRow" },
    { label: "Merge or split cells", run: "mergeOrSplit" }
  ],
  [
    { label: "Delete row", run: "deleteRow" },
    { label: "Delete column", run: "deleteColumn" },
    { label: "Delete table", run: "deleteTable" }
  ]
] as const

export function TableDropdownMenu() {
  const { editor } = useTiptapEditor()
  const [isOpen, setIsOpen] = useState(false)
  const isInTable = editor?.isActive("table") ?? false

  return (
    <DropdownMenu modal={false} onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Table options"
          data-active-state={isInTable ? "on" : "off"}
          tooltip="Table"
          type="button"
          variant="ghost"
        >
          <TableIcon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            Insert table
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {tableActionGroups.map((group) => (
          <Fragment key={group[0].run}>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {group.map((action) => (
                <DropdownMenuItem
                  disabled={!isInTable}
                  key={action.run}
                  onSelect={() => editor?.chain().focus()[action.run]().run()}
                  variant={action.label.startsWith("Delete") ? "destructive" : "default"}
                >
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

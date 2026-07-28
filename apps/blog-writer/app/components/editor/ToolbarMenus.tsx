import type { Editor } from "@tiptap/react"
import { useState } from "react"
// --- Vendored Tiptap primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/tiptap-ui-primitive/dropdown-menu"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon, ChevronDownIcon } from "./editor-icons"

/**
 * The two menus the admin's own article editor offers: one for the block a paragraph is written as, and one for how
 * it is aligned. Both name their options and mark the one in force, which is what makes the current state readable
 * without the merchant having to decode a row of pressed icons.
 */

/** Every level the sanitizer keeps, so a writer can match the heading structure their theme expects. */
export const headingLevels = [1, 2, 3, 4, 5, 6] as const

type HeadingLevel = (typeof headingLevels)[number]

const paragraphValue = "paragraph"
const blockquoteValue = "blockquote"

function headingValue(level: HeadingLevel) {
  return `heading-${level}`
}

/** Reads back the block the cursor sits in, falling back to a paragraph the way an empty document starts out. */
function activeTextStyle(editor: Editor) {
  if (editor.isActive(blockquoteValue)) {
    return blockquoteValue
  }
  const level = headingLevels.find((candidate) => editor.isActive("heading", { level: candidate }))
  return level === undefined ? paragraphValue : headingValue(level)
}

function applyTextStyle(editor: Editor, value: string) {
  const chain = editor.chain().focus()
  // Choosing anything else while inside a quote lifts the text out of it, so the menu stays a single choice.
  if (editor.isActive(blockquoteValue) && value !== blockquoteValue) {
    chain.toggleBlockquote()
  }
  if (value === blockquoteValue) {
    chain.toggleBlockquote()
  } else if (value === paragraphValue) {
    chain.setParagraph()
  } else {
    const level = headingLevels.find((candidate) => headingValue(candidate) === value)
    if (level !== undefined) {
      chain.setNode("heading", { level })
    }
  }
  chain.run()
}

export function TextStyleDropdownMenu() {
  const { editor } = useTiptapEditor()
  const [isOpen, setIsOpen] = useState(false)
  const activeValue = editor === null ? paragraphValue : activeTextStyle(editor)

  const options = [
    { label: "Paragraph", value: paragraphValue },
    ...headingLevels.map((level) => ({ label: `Heading ${level}`, value: headingValue(level) })),
    { label: "Blockquote", value: blockquoteValue }
  ]
  const activeLabel = options.find((option) => option.value === activeValue)?.label ?? "Paragraph"

  return (
    <DropdownMenu modal={false} onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Formatting: ${activeLabel}`}
          className="article-editor__style-trigger"
          data-active-state={isOpen ? "on" : "off"}
          type="button"
          variant="ghost"
        >
          <span className="tiptap-button-text">{activeLabel}</span>
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="article-editor__style-menu">
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (editor !== null) {
              applyTextStyle(editor, value)
            }
          }}
          value={activeValue}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              className={`article-editor__style-option article-editor__style-option--${option.value}`}
              key={option.value}
              value={option.value}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const alignments = [
  { Icon: AlignLeftIcon, label: "Left", value: "left" },
  { Icon: AlignCenterIcon, label: "Center", value: "center" },
  { Icon: AlignRightIcon, label: "Right", value: "right" }
] as const

/** Text with no alignment of its own reads as left aligned, which is what the trigger should say. */
function activeAlignment(editor: Editor) {
  return alignments.find(({ value }) => editor.isActive({ textAlign: value }))?.value ?? "left"
}

export function TextAlignDropdownMenu() {
  const { editor } = useTiptapEditor()
  const [isOpen, setIsOpen] = useState(false)
  const activeValue = editor === null ? "left" : activeAlignment(editor)

  const active = alignments.find(({ value }) => value === activeValue) ?? alignments[0]

  return (
    <DropdownMenu modal={false} onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Alignment: ${active.label}`} tooltip="Alignment" type="button" variant="ghost">
          <active.Icon className="tiptap-button-icon" />
          <ChevronDownIcon className="tiptap-button-dropdown-small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          onValueChange={(value) => editor?.chain().focus().setTextAlign(value).run()}
          value={activeValue}
        >
          {alignments.map(({ Icon, label, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="tiptap-button-icon" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

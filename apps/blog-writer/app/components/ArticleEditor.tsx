import { Highlight } from "@tiptap/extension-highlight"
import { Image } from "@tiptap/extension-image"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { TableKit } from "@tiptap/extension-table"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Selection } from "@tiptap/extensions"
import { EditorContent, EditorContext, useEditor, useEditorState } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useEffect, useRef, useState } from "react"
// --- Tiptap node extension and styles ---
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

import { Button } from "@/components/tiptap-ui-primitive/button"
import { Toolbar, ToolbarGroup, ToolbarSeparator } from "@/components/tiptap-ui-primitive/toolbar"
// --- Tiptap UI ---
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import { ColorHighlightPopover } from "@/components/tiptap-ui/color-highlight-popover"
import { LinkPopover } from "@/components/tiptap-ui/link-popover"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
// --- Article editor additions ---
import { AiText } from "./editor/ai-text-extension"
import { HtmlIcon } from "./editor/editor-icons"
import { Embed } from "./editor/embed-node"
import { HtmlSourceEditor } from "./editor/HtmlSourceEditor"
import { InsertEmbedModal, InsertImageButton, TableDropdownMenu } from "./editor/InsertControls"
import type { PickEditorImage } from "./editor/InsertControls"
import { RewriteButton } from "./editor/RewriteControl"
import type { RewriteSelection } from "./editor/RewriteControl"
import { SelectionMenu } from "./editor/SelectionMenu"
import type { SearchResources } from "./editor/SelectionMenu"
import { headingLevels, TextAlignDropdownMenu, TextStyleDropdownMenu } from "./editor/ToolbarMenus"
// --- Shared Tiptap design tokens ---
import "@/styles/_keyframe-animations.scss"
import "@/styles/_variables.scss"
import "./ArticleEditor.css"

export type ArticleEditorProps = {
  /** Form field that carries the body HTML back to the action, where it is sanitized before it is stored. */
  name: string
  defaultValue: string
  isDisabled: boolean
  accessibilityLabel: string
  /** `compact` opens the writing surface at the height of a short field; every control stays the same. */
  size?: "base" | "compact"
  onChange?: (html: string) => void
  /** Supplying a handler turns its control on; leaving it out keeps that control off the toolbar entirely. */
  pickImage?: PickEditorImage
  rewriteSelection?: RewriteSelection
  searchResources?: SearchResources
}

export function ArticleEditor({
  name,
  defaultValue,
  isDisabled,
  accessibilityLabel,
  size = "base",
  onChange,
  pickImage,
  rewriteSelection,
  searchResources
}: ArticleEditorProps) {
  const isCompact = size === "compact"
  const [isHtmlVisible, setIsHtmlVisible] = useState(false)
  const editor = useEditor({
    immediatelyRender: false,
    content: defaultValue,
    editable: !isDisabled,
    editorProps: {
      attributes: {
        "aria-label": accessibilityLabel,
        "aria-multiline": "true",
        class: "article-editor__surface",
        role: "textbox",
        spellcheck: "true"
      }
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [...headingLevels] },
        horizontalRule: false,
        link: {
          defaultProtocol: "https",
          enableClickSelection: true,
          openOnClick: false,
          protocols: ["http", "https", "mailto"]
        }
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Highlight.configure({ multicolor: true }),
      AiText,
      Image,
      Embed,
      TableKit.configure({ table: { resizable: true } }),
      Selection,
      Subscript,
      Superscript,
      Typography
    ]
  })

  const editorState = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      html: instance?.getHTML() ?? defaultValue,
      text: instance?.getText() ?? ""
    })
  })

  // `useEditor` reads `editable` only when it builds the instance, so later saves have to push the change in.
  useEffect(() => {
    editor?.setEditable(!isDisabled)
  }, [editor, isDisabled])

  const bodyHtml = editorState?.html ?? defaultValue
  const text = editorState?.text ?? ""
  const frameClasses = ["article-editor"]
  if (isCompact) {
    frameClasses.push("article-editor--compact")
  }

  /*
   * The parent tracks unsaved work, so it needs the markup as it is typed. Tiptap re-serializes the document when it
   * loads, which can differ harmlessly from the stored string, so the first serialization becomes the baseline
   * instead of counting as an edit.
   */
  const baselineHtml = useRef<string | null>(null)
  useEffect(() => {
    if (editorState === undefined || editorState === null) {
      return
    }
    if (baselineHtml.current === null) {
      baselineHtml.current = editorState.html
      return
    }
    if (editorState.html !== baselineHtml.current) {
      onChange?.(editorState.html)
    }
  }, [editorState, onChange])

  return (
    <div className={frameClasses.join(" ")}>
      <EditorContext.Provider value={{ editor }}>
        <Toolbar aria-label={`${accessibilityLabel} formatting`} className="article-editor__toolbar" variant="fixed">
          {rewriteSelection === undefined ? null : (
            <>
              <ToolbarGroup>
                <RewriteButton rewriteSelection={rewriteSelection} />
              </ToolbarGroup>

              <ToolbarSeparator />
            </>
          )}

          <ToolbarGroup>
            <TextStyleDropdownMenu />
            <ListDropdownMenu modal={false} types={["bulletList", "orderedList"]} />
            <CodeBlockButton />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <MarkButton type="bold" />
            <MarkButton type="italic" />
            <MarkButton type="underline" />
            <MarkButton type="strike" />
            <ColorHighlightPopover />
            <LinkPopover />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <MarkButton type="superscript" />
            <MarkButton type="subscript" />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            <TextAlignDropdownMenu />
          </ToolbarGroup>

          <ToolbarSeparator />

          <ToolbarGroup>
            {pickImage === undefined ? null : <InsertImageButton pickImage={pickImage} />}
            <InsertEmbedModal />
            <TableDropdownMenu />
          </ToolbarGroup>

          <ToolbarGroup className="article-editor__toolbar-end">
            <Button
              aria-label="View HTML"
              aria-pressed={isHtmlVisible}
              data-active-state={isHtmlVisible ? "on" : "off"}
              onClick={() => setIsHtmlVisible(!isHtmlVisible)}
              tooltip="View HTML"
              type="button"
              variant="ghost"
            >
              <HtmlIcon className="tiptap-button-icon" />
            </Button>
          </ToolbarGroup>
        </Toolbar>

        <SelectionMenu rewriteSelection={rewriteSelection} searchResources={searchResources} />

        <EditorContent className="article-editor__content" editor={editor} hidden={isHtmlVisible} role="presentation" />
      </EditorContext.Provider>

      {isHtmlVisible ? (
        <HtmlSourceEditor
          accessibilityLabel={accessibilityLabel}
          isDisabled={isDisabled}
          onChange={(html) => editor?.commands.setContent(html)}
          value={bodyHtml}
        />
      ) : null}

      <p className="article-editor__status">
        {pluralize(countWords(text), "word")}, {pluralize(text.length, "character")}
      </p>

      <input name={name} type="hidden" value={bodyHtml} />
    </div>
  )
}

function countWords(text: string) {
  const trimmed = text.trim()
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length
}

function pluralize(count: number, noun: string) {
  return `${count.toLocaleString()} ${count === 1 ? noun : `${noun}s`}`
}

import { useId, useState } from "react"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card"
import { Input } from "@/components/tiptap-ui-primitive/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/tiptap-ui-primitive/popover"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
import { markAiText } from "./ai-text-extension"
import { SparkleIcon } from "./editor-icons"

export type RewriteSelection = (text: string, instruction: string) => Promise<{ text: string } | { error: string }>

/**
 * The wand control that hands selected text to a workflow and puts the reply back in its place.
 * It sits in the fixed toolbar the way the admin's own editors carry their AI control, and again in the menu that
 * follows a selection, so the action is where the merchant is already looking in either case.
 */
export function RewriteButton({ rewriteSelection }: { rewriteSelection: RewriteSelection }) {
  const { editor } = useTiptapEditor()
  const [isOpen, setIsOpen] = useState(false)
  const [instruction, setInstruction] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)
  const instructionFieldId = useId()

  async function rewrite() {
    if (editor === null) {
      return
    }
    const { from, to } = editor.state.selection
    const selected = editor.state.doc.textBetween(from, to, " ").trim()
    if (selected === "") {
      setError("Select the text you want rewritten")
      return
    }
    setIsRewriting(true)
    setError(null)
    const result = await rewriteSelection(selected, instruction.trim())
    setIsRewriting(false)
    if ("error" in result) {
      setError(result.error)
      return
    }
    /*
     * The reply lands as a text node rather than parsed markup. Tiptap reads a string as HTML, so inserting one
     * would let a model's output introduce nodes the merchant never asked for.
     */
    const written = result.text.replace(/\s*\n+\s*/g, " ")
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to }, [{ type: "text", text: written }])
      .run()
    // Only the words that came back are the workflow's, so the colour covers them rather than the whole field.
    markAiText(editor, { from, to: from + written.length })
    setIsOpen(false)
    setInstruction("")
  }

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <Button aria-label="Rewrite text" tooltip="Rewrite text" type="button" variant="ghost">
          <SparkleIcon className="tiptap-button-icon" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Rewrite text">
        <Card className="article-editor__popover">
          <CardBody>
            <CardItemGroup>
              <label className="tiptap-card-group-label" htmlFor={instructionFieldId}>
                How should it change?
              </label>
              <Input
                id={instructionFieldId}
                onChange={(event) => {
                  setInstruction(event.target.value)
                  setError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void rewrite()
                  }
                }}
                placeholder="Make it shorter and friendlier"
                type="text"
                value={instruction}
              />
            </CardItemGroup>
            {error === null ? null : <p role="alert">{error}</p>}
            <Button
              disabled={instruction.trim().length < 3 || isRewriting}
              onClick={() => void rewrite()}
              type="button"
              variant="primary"
            >
              {isRewriting ? "Rewriting" : "Rewrite"}
            </Button>
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

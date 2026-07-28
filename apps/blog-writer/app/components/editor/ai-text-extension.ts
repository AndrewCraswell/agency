import { Extension } from "@tiptap/core"
import type { Editor } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

type AiRange = { from: number; to: number }

const aiTextKey = new PluginKey<DecorationSet>("articleAiText")

/**
 * Colours the stretch of text a workflow just wrote, without putting anything in the document.
 *
 * A stored mark would travel into the saved HTML and out to the storefront, which is not what the colour means -- it
 * says "this is not your writing yet", so it belongs to the editing session and not to the article. Holding it as a
 * decoration also lets the range follow the merchant's own edits, and lets it disappear the moment the field is saved
 * or discarded and the editor is rebuilt.
 */
export const AiText = Extension.create({
  name: "articleAiText",

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: aiTextKey,
        state: {
          init: () => DecorationSet.empty,
          apply(transaction, marked) {
            // Mapping first keeps an existing mark over its own words as the merchant edits around them.
            const moved = marked.map(transaction.mapping, transaction.doc)
            const range = transaction.getMeta(aiTextKey) as AiRange | undefined
            if (range === undefined) {
              return moved
            }
            return moved.add(transaction.doc, [
              Decoration.inline(range.from, range.to, { class: "article-editor__ai-text" })
            ])
          }
        },
        props: {
          decorations(state) {
            return aiTextKey.getState(state)
          }
        }
      })
    ]
  }
})

/** Marks text between two positions as workflow-written. */
export function markAiText(editor: Editor, range: AiRange) {
  editor.view.dispatch(editor.state.tr.setMeta(aiTextKey, range))
}

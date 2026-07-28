import { useState } from "react"
import { formatArticleHtml, tokenizeHtml } from "./html-source"

export interface HtmlSourceEditorProps {
  accessibilityLabel: string
  isDisabled: boolean
  /** The markup the editor holds. It seeds the panel; afterwards the text on screen is what the writer typed. */
  value: string
  onChange: (html: string) => void
}

/**
 * The source view. A transparent textarea sits exactly on top of the coloured copy of the same text, so the writer
 * gets the browser's own editing, selection, and undo while still seeing the markup highlighted. Both layers share a
 * scroll box and every metric that affects wrapping, which is what keeps the caret over the character it is on.
 */
export function HtmlSourceEditor({ accessibilityLabel, isDisabled, onChange, value }: HtmlSourceEditorProps) {
  const [source, setSource] = useState(() => formatArticleHtml(value))

  return (
    <div className="article-editor__html">
      <div className="article-editor__html-frame">
        {/* A trailing newline keeps the painted copy as tall as the box, since `pre` swallows the last one. */}
        <pre aria-hidden="true" className="article-editor__html-highlight">
          <code>
            {tokenizeHtml(source).map((token, index) => (
              <span className={`article-editor__html-${token.kind}`} key={index}>
                {token.text}
              </span>
            ))}
            {"\n"}
          </code>
        </pre>
        <textarea
          aria-label={`${accessibilityLabel} HTML`}
          autoCapitalize="off"
          autoCorrect="off"
          className="article-editor__html-input"
          onChange={(event) => {
            setSource(event.target.value)
            onChange(event.target.value)
          }}
          readOnly={isDisabled}
          spellCheck={false}
          value={source}
        />
      </div>
    </div>
  )
}

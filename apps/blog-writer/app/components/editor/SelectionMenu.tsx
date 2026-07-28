import { useDebouncedValue } from "@mantine/hooks"
import { BubbleMenu } from "@tiptap/react/menus"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card"
import { Input } from "@/components/tiptap-ui-primitive/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/tiptap-ui-primitive/popover"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"
// --- Vendored Tiptap primitives ---
import { LinkIcon } from "./editor-icons"
import { ArticleIcon, CollectionIcon, PageIcon, ProductIcon } from "./editor-icons"
import type { LinkableResource } from "./editor-services"
import { RewriteButton } from "./RewriteControl"
import type { RewriteSelection } from "./RewriteControl"

export type SearchResources = (term: string, signal?: AbortSignal) => Promise<LinkableResource[]>

/** The icon carries the resource type, so each result reads as its title rather than repeating a type prefix. */
const resourceIcons = {
  product: ProductIcon,
  collection: CollectionIcon,
  page: PageIcon,
  blog: ArticleIcon,
  article: ArticleIcon
}

const resourceLabels = {
  product: "Product",
  collection: "Collection",
  page: "Page",
  blog: "Blog",
  article: "Article"
}

/** Short terms match most of the catalogue, so searching waits until the merchant has narrowed it down. */
const minimumTermLength = 2

function CrosslinkPopover({ searchResources }: { searchResources: SearchResources }) {
  const { editor } = useTiptapEditor()
  const [isOpen, setIsOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [debouncedTerm] = useDebouncedValue(term, 250)
  const [resources, setResources] = useState<LinkableResource[]>([])
  const [searchedTerm, setSearchedTerm] = useState("")
  const searchFieldId = useId()

  const trimmedTerm = debouncedTerm.trim()
  const isTermSearchable = trimmedTerm.length >= minimumTermLength
  /*
   * Both of these are derived rather than stored, so the effect never sets state on its way in. The previous matches
   * stay on screen while the next request is in flight, which keeps the list from flickering between keystrokes.
   */
  const isSearching = isTermSearchable && searchedTerm !== trimmedTerm
  const matches = isTermSearchable ? resources : []

  useEffect(() => {
    const trimmed = debouncedTerm.trim()
    if (trimmed.length < minimumTermLength) {
      return
    }
    const controller = new AbortController()
    searchResources(trimmed, controller.signal)
      .then((found) => {
        setResources(found)
        setSearchedTerm(trimmed)
      })
      .catch(() => {
        // An aborted request is replaced by the next keystroke, so there is nothing to report here.
      })
    return () => controller.abort()
  }, [debouncedTerm, searchResources])

  function linkTo(resource: LinkableResource) {
    editor?.chain().focus().setLink({ href: resource.url }).run()
    setIsOpen(false)
    setTerm("")
  }

  return (
    <Popover onOpenChange={setIsOpen} open={isOpen}>
      <PopoverTrigger asChild>
        <Button aria-label="Add crosslink" tooltip="Add crosslink" type="button" variant="ghost">
          <LinkIcon className="tiptap-button-icon" />
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label="Add crosslink">
        <Card className="article-editor__popover">
          <CardBody>
            <CardItemGroup>
              <label className="tiptap-card-group-label" htmlFor={searchFieldId}>
                Link to
              </label>
              <Input
                autoComplete="off"
                id={searchFieldId}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search products, collections, pages, posts"
                type="search"
                value={term}
              />
            </CardItemGroup>
            <ul aria-busy={isSearching} aria-label="Search results" className="article-editor__crosslinks">
              {matches.map((resource) => {
                const Icon = resourceIcons[resource.resourceType]
                return (
                  <li key={resource.resourceId}>
                    <Button onClick={() => linkTo(resource)} showTooltip={false} type="button" variant="ghost">
                      <Icon className="tiptap-button-icon" />
                      <span className="tiptap-button-text">{resource.title}</span>
                      <span className="article-editor__crosslink-type">{resourceLabels[resource.resourceType]}</span>
                    </Button>
                  </li>
                )
              })}
            </ul>
            {isSearching || matches.length > 0 || !isTermSearchable ? null : <p>No matching storefront content</p>}
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  )
}

/**
 * The floating menu that follows a text selection.
 * Each action is opt-in: an editor rendered without the matching callback simply does not offer that control.
 */
export function SelectionMenu({
  rewriteSelection,
  searchResources
}: {
  rewriteSelection?: RewriteSelection
  searchResources?: SearchResources
}) {
  const { editor } = useTiptapEditor()
  if (editor === null || (rewriteSelection === undefined && searchResources === undefined)) {
    return null
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: instance, state }) => !state.selection.empty && instance.isEditable}
    >
      <div aria-label="Selected text actions" className="article-editor__selection-menu" role="toolbar">
        {rewriteSelection === undefined ? null : <RewriteButton rewriteSelection={rewriteSelection} />}
        {searchResources === undefined ? null : <CrosslinkPopover searchResources={searchResources} />}
      </div>
    </BubbleMenu>
  )
}

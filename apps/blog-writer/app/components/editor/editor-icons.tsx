import { memo } from "react"

type SvgProps = React.ComponentPropsWithoutRef<"svg">

/** The names Polaris publishes for its icon set, so a glyph that the admin does not ship fails to compile. */
type PolarisIconType = NonNullable<React.ComponentProps<"s-icon">["type"]>

/**
 * The admin's own icon set, reached through the Polaris `s-icon` element. Shopify's rich text editors draw their
 * toolbars from exactly this set, so borrowing it is what makes this editor read as part of the admin rather than
 * as a widget dropped into it. Icons are decorative: every control they sit inside carries its own accessible name.
 *
 * The Polaris element takes no class of its own, so a span carries the class the Tiptap controls hand down — the
 * same shape the admin uses, where each icon sits in a sized box inside the button.
 *
 * A few glyphs have no Polaris counterpart — strikethrough, superscript, subscript, justified text, and the heading
 * levels. Those keep the vendored Tiptap drawings, which sit at the same weight.
 */
function polarisIcon(type: PolarisIconType, displayName: string, size?: React.ComponentProps<"s-icon">["size"]) {
  const Icon = memo(({ className }: SvgProps) => (
    <span className={className}>
      <s-icon size={size} type={type} />
    </span>
  ))
  Icon.displayName = displayName
  return Icon
}

/**
 * Shared outline frame for the one icon this app still draws itself.
 */
function OutlineIcon({ children, ...props }: SvgProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  )
}

/* --- Controls this app adds --- */

export const ImageIcon = polarisIcon("image", "ImageIcon")
export const VideoIcon = polarisIcon("video", "VideoIcon")
export const TableIcon = polarisIcon("table", "TableIcon")
export const SparkleIcon = polarisIcon("wand", "SparkleIcon")
export const SearchIcon = polarisIcon("search", "SearchIcon")
export const ProductIcon = polarisIcon("product", "ProductIcon")
export const CollectionIcon = polarisIcon("collection", "CollectionIcon")
export const PageIcon = polarisIcon("page", "PageIcon")
export const ArticleIcon = polarisIcon("blog", "ArticleIcon")

/* --- Replacements for the vendored Tiptap glyphs, exported under the names those components already import --- */

export const BoldIcon = polarisIcon("text-bold", "BoldIcon")
export const ItalicIcon = polarisIcon("text-italic", "ItalicIcon")
export const UnderlineIcon = polarisIcon("text-underline", "UnderlineIcon")
export const Code2Icon = polarisIcon("code", "Code2Icon")
export const BlockquoteIcon = polarisIcon("text-quote", "BlockquoteIcon")
export const HighlighterIcon = polarisIcon("text-color", "HighlighterIcon")
export const BanIcon = polarisIcon("color-none", "BanIcon")
export const LinkIcon = polarisIcon("link", "LinkIcon")
export const ExternalLinkIcon = polarisIcon("arrow-up-right", "ExternalLinkIcon")
export const TrashIcon = polarisIcon("delete", "TrashIcon")
export const ListIcon = polarisIcon("list-bulleted", "ListIcon")
export const ListOrderedIcon = polarisIcon("list-numbered", "ListOrderedIcon")
export const ListTodoIcon = polarisIcon("checkbox", "ListTodoIcon")
export const AlignLeftIcon = polarisIcon("text-align-left", "AlignLeftIcon")
export const AlignCenterIcon = polarisIcon("text-align-center", "AlignCenterIcon")
export const AlignRightIcon = polarisIcon("text-align-right", "AlignRightIcon")
export const HeadingIcon = polarisIcon("text-title", "HeadingIcon")
export const Undo2Icon = polarisIcon("undo", "Undo2Icon")
export const Redo2Icon = polarisIcon("redo", "Redo2Icon")
/** Polaris draws its icons at a fixed size, so the chevron has to ask for the small one to fit a dropdown arrow. */
export const ChevronDownIcon = polarisIcon("chevron-down", "ChevronDownIcon", "small")
export const CheckIcon = polarisIcon("check", "CheckIcon", "small")

/** Kept as a drawing because Polaris has no angle-bracket glyph, and this is the one merchants recognise. */
export const HtmlIcon = memo((props: SvgProps) => (
  <OutlineIcon {...props}>
    <path d="m18 16 4-4-4-4" />
    <path d="m6 8-4 4 4 4" />
    <path d="m14.5 4-5 16" />
  </OutlineIcon>
))
HtmlIcon.displayName = "HtmlIcon"

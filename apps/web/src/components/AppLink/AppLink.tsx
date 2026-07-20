import { Link as FluentLink } from "@fluentui/react-components"
import { createLink, type LinkComponent } from "@tanstack/react-router"

// Fluent's Link already renders an <a> and forwards its ref to it, so it can be
// driven directly by TanStack Router's `createLink` — the router supplies the
// resolved `href`, intent handlers, and ref while Fluent supplies the styling.
const RouterFluentLink = createLink(FluentLink)

/**
 * A navigation link that is a real TanStack Router `<Link>` — typed `to`,
 * active state, and route preloading — rendered with Fluent UI's `<Link>`
 * styling.
 *
 * Preloading defaults to `"intent"`: the target route's code and loader data
 * are prefetched when the user hovers or focuses the link. Override per link
 * with `preload={false}` to opt out, or `preload="viewport"` / `"render"`.
 *
 * ```tsx
 * <AppLink to="/workflows">Workflows</AppLink>
 * <AppLink to="/integrations" preload={false}>Integrations</AppLink>
 * ```
 */
export const AppLink: LinkComponent<typeof FluentLink> = (props) => <RouterFluentLink preload="intent" {...props} />

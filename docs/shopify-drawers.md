# Shopify Drawers

`snippets/ui-drawer.liquid`, `assets/component-drawer.css`, and `assets/ui-drawer.js` provide the shared drawer shell.
The size-chart product block is the first consumer. Cart, navigation, pickup, and centered dialogs retain their
existing controllers; they are not silently migrated by loading this component.

## Rendering

Render caller content with Liquid `capture`, then pass it to `ui-drawer`. Required parameters are `id` (unique
per instance), `title`, `close_label`, and `content`. Optional parameters are `trigger`, `description`, `footer`,
`size: 'wide'`, `side: 'start'`, and Shopify block `attributes`.

The trigger HTML belongs inside the component. Include `data-drawer-open`, `aria-haspopup="dialog"`,
`aria-expanded="false"`, and `aria-controls` matching the dialog ID. Prefer a real page link when equivalent
content exists, so no-JavaScript and modified clicks retain navigation. Plain titles/labels are escaped; captured
HTML must come from trusted Liquid renderers, not arbitrary customer input.

Default width is 400px, wide is 600px; both cap at the viewport width. Start/end positioning follows text direction.
The header and optional footer remain visible while the body scrolls. Keep sticky regions short on narrow screens.
Assets are loaded by the snippet; repeated rendering is safe because the custom-element registration is guarded.

## Behavior

- `drawer.show(opener)` returns whether opening is supported; `drawer.hide()` dismisses it.
- The panel translates and the backdrop fades over 250ms using the Web Animations API. Interrupted transitions
  resume from the current visual position; stale animation completions cannot close a reopened drawer.
- Reduced motion, including a preference change mid-transition, skips motion. Browsers without animation support
  retain immediate dialog operation. Browsers without native dialog support retain trigger-link navigation.
- Focus starts on Close. Native modal containment remains active until the exit completes. Close, Escape, native
  cancel, and backdrop pointer taps dismiss; dragging out of the panel does not count as a backdrop tap.
- Scroll locking compensates for the scrollbar and restores prior inline values and priorities. Multiple drawer
  instances share lock ownership. Nested drawers restore focus to their opener without unlocking the parent.
- Removal and reconnection clean up listeners, animations, and scroll locks. `drawer:opened` and `drawer:closed`
  bubble after their transitions complete; they do not mutate consumer data.

Keep business logic outside the shell: sizing selection, cart requests, navigation, and form submission belong to
their own controllers. Do not use a sliding drawer as a replacement for every centered modal.

## Verification

Run the theme's Vitest coverage suite and Shopify Theme Check. Browser acceptance must include desktop and mobile,
actual intermediate motion, rapid close/reopen, reduced motion, keyboard focus containment/return, backdrop taps,
and unchanged consumer state. The sizing fixture tests the production shell with local chart data; it does not
replace acceptance with active Shopify content.
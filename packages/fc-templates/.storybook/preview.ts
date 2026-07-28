import { definePreview } from "@repo/storybook-config/preview"

const THEMES = ["light", "dark"] as const

export default definePreview({
  parameters: {
    // Every story is one rendered template, so there is nothing to control and nothing to pad.
    controls: { disable: true },
    layout: "fullscreen"
  },
  initialGlobals: { theme: THEMES[0] },
  globalTypes: {
    theme: {
      description: "Colour scheme for the frame around the template",
      toolbar: {
        icon: "contrast",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" }
        ],
        dynamicTitle: true
      }
    }
  },
  decorators: [
    /*
     * The card's palette hangs off `data-theme` the same way the preview viewer's does, so the
     * toolbar only has to move that one attribute.
     */
    (Story, { globals }) => {
      document.documentElement.dataset.theme = String(globals.theme ?? THEMES[0])
      return Story()
    }
  ]
})

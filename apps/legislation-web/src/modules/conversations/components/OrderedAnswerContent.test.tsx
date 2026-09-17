// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OrderedAnswerPart } from "./orderedAnswer"
import { OrderedAnswerContent } from "./OrderedAnswerContent"

const motion = vi.hoisted(() => ({ reduced: false, visibility: "visible" }))
vi.mock("@mantine/hooks", async (original) => ({
  ...(await original<typeof import("@mantine/hooks")>()),
  useReducedMotion: () => motion.reduced,
  useDocumentVisibility: () => motion.visibility
}))

class TextEffect {
  target: Element
  constructor(target: Element) {
    this.target = target
  }
  getComputedTiming() {
    return { endTime: 470 }
  }
}

const originalAnimations = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations")
let animations: ReturnType<typeof animation>[] = []

function animation() {
  const target = document.createElement("span")
  target.setAttribute("data-sd-animate", "true")
  const completion = Promise.withResolvers<void>()
  return {
    effect: new TextEffect(target),
    playState: "running",
    finished: completion.promise,
    finish: vi.fn<() => void>(() => completion.resolve()),
    complete: completion.resolve,
    cancel: completion.reject
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  motion.reduced = false
  motion.visibility = "visible"
  animations = []
  vi.stubGlobal("KeyframeEffect", TextEffect)
  Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: () => animations })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalAnimations) {
    Object.defineProperty(HTMLElement.prototype, "getAnimations", originalAnimations)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, "getAnimations")
  }
})

const prose: OrderedAnswerPart = {
  type: "text",
  key: "text:0",
  text: "Before: 中文 cafe\u0301 😀 [source](#citation-e1)"
}
const card: OrderedAnswerPart = {
  type: "presentation",
  key: "presentation:one",
  part: { type: "data-presentation", id: "one", data: { state: "ready" } }
}
const following: OrderedAnswerPart = { type: "text", key: "text:2", text: "Following prose" }
const parts = [prose, card, following]
function view(currentParts: readonly OrderedAnswerPart[] = parts, isRunning = true) {
  return (
    <OrderedAnswerContent
      parts={currentParts}
      isRunning={isRunning}
      renderPart={(part, animate) =>
        part.type === "text" ? (
          <p key={part.key} data-motion={animate}>
            {part.text}
          </p>
        ) : (
          <button key={part.key}>{part.key}</button>
        )
      }
    >
      <p>Sources and actions</p>
    </OrderedAnswerContent>
  )
}

describe("ordered animation completion", () => {
  it("does not force animation inspection while prose streams without a waiting block", () => {
    const inspect = vi.spyOn(HTMLElement.prototype, "getAnimations")
    const rendered = render(view([prose]))
    rendered.rerender(view([{ ...prose, text: prose.text + " More text." }]))
    expect(inspect).not.toHaveBeenCalled()
    inspect.mockRestore()
  })

  it.each(["completion", "reduced motion", "background"])(
    "does not suppress future prose when %s occurs before content arrives",
    (reason) => {
      motion.reduced = reason === "reduced motion"
      motion.visibility = reason === "background" ? "hidden" : "visible"
      const rendered = render(view([], reason !== "completion"))
      motion.reduced = false
      motion.visibility = "visible"
      rendered.rerender(view([prose]))
      expect(screen.getByText(prose.text).getAttribute("data-motion")).toBe("true")
    }
  )

  it("withholds a card, following prose and footer until preceding text animations finish", async () => {
    const pending = animation()
    animations = [pending]
    render(view())
    expect(screen.getByText(prose.text)).toBeDefined()
    expect(screen.queryByRole("button")).toBeNull()
    expect(screen.queryByText(following.text)).toBeNull()
    expect(screen.queryByText("Sources and actions")).toBeNull()
    await act(async () => pending.complete())
    expect(screen.getByRole("button", { name: card.key })).toBeDefined()
    expect(screen.getByText(following.text)).toBeDefined()
    expect(screen.getByText("Sources and actions")).toBeDefined()
  })

  it("caps waiting at 500ms without extending the deadline on unrelated rerenders", async () => {
    const pending = animation()
    animations = [pending]
    const rendered = render(view())
    await act(async () => vi.advanceTimersByTime(400))
    rendered.rerender(view([...parts]))
    await act(async () => vi.advanceTimersByTime(99))
    expect(screen.queryByRole("button")).toBeNull()
    await act(async () => vi.advanceTimersByTime(1))
    expect(pending.finish).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: card.key })).toBeDefined()
  })

  it("ignores non-text and infinite animations", () => {
    const unrelated = animation()
    unrelated.effect.target.removeAttribute("data-sd-animate")
    const infinite = animation()
    infinite.effect.getComputedTiming = () => ({ endTime: Infinity })
    animations = [unrelated, infinite]
    render(view())
    expect(screen.getByRole("button", { name: card.key })).toBeDefined()
    expect(unrelated.finish).not.toHaveBeenCalled()
    expect(infinite.finish).not.toHaveBeenCalled()
  })

  it.each(["completion", "reduced motion", "background"])(
    "drains received content on %s and never hides it again",
    (reason) => {
      const pending = animation()
      animations = [pending]
      const rendered = render(view())
      if (reason === "reduced motion") {
        motion.reduced = true
      }
      if (reason === "background") {
        motion.visibility = "hidden"
      }
      rendered.rerender(view(parts, reason !== "completion"))
      expect(screen.getByRole("button", { name: card.key })).toBeDefined()
      expect(screen.getByText(prose.text)).toBeDefined()
      expect(pending.finish).toHaveBeenCalled()
      motion.reduced = false
      motion.visibility = "visible"
      rendered.rerender(view(parts, reason !== "completion"))
      expect(screen.getByRole("button", { name: card.key })).toBeDefined()
      expect(screen.getByText(prose.text).getAttribute("data-motion")).toBe(String(reason === "background"))
    }
  )

  it("does not reenable animation after reduced motion but resets for a new answer", () => {
    const rendered = render(<div key="first">{view()}</div>)
    expect(screen.getByText(prose.text).getAttribute("data-motion")).toBe("true")
    motion.reduced = true
    rendered.rerender(<div key="first">{view()}</div>)
    motion.reduced = false
    rendered.rerender(<div key="first">{view([...parts, { type: "text", key: "new", text: "New text" }])}</div>)
    expect(screen.getByText(prose.text).getAttribute("data-motion")).toBe("false")
    expect(screen.getByText("New text").getAttribute("data-motion")).toBe("false")
    rendered.rerender(<div key="second">{view()}</div>)
    expect(screen.getByText(prose.text).getAttribute("data-motion")).toBe("true")
  })

  it("releases canceled animations and preserves a revealed card's identity and focus", async () => {
    const pending = animation()
    animations = [pending]
    const rendered = render(view())
    await act(async () => pending.cancel(new Error("Animation canceled")))
    const button = screen.getByRole("button", { name: card.key })
    button.focus()
    animations = [animation()]
    rendered.rerender(view([...parts, { type: "text", key: "text:3", text: "More prose" }]))
    expect(screen.getByRole("button", { name: card.key })).toBe(button)
    expect(document.activeElement).toBe(button)
  })

  it("waits separately for the prose before each later block", async () => {
    const initial = animation()
    animations = [initial]
    const rendered = render(view())
    await act(async () => initial.complete())
    const next = animation()
    animations = [next]
    const later: OrderedAnswerPart = { ...card, key: "presentation:two" }
    rendered.rerender(view([...parts, later]))
    expect(screen.getByRole("button", { name: card.key })).toBeDefined()
    expect(screen.queryByRole("button", { name: later.key })).toBeNull()
    await act(async () => next.complete())
    expect(screen.getByRole("button", { name: later.key })).toBeDefined()
  })

  it("cleans up a pending wait on unmount", async () => {
    const pending = animation()
    animations = [pending]
    const rendered = render(view())
    rendered.unmount()
    await act(async () => vi.advanceTimersByTime(500))
    expect(pending.finish).not.toHaveBeenCalled()
    await act(async () => pending.complete())
    expect(screen.queryByRole("button")).toBeNull()
  })
})

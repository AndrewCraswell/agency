import type { ReactElement, ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { runInValueMode } from "./liquid/environment.ts"
import type { LiquidEvaluator } from "./liquid/mode.ts"
import {
  Assign,
  Capture,
  Case,
  Else,
  ElseIf,
  Find,
  For,
  If,
  liquidValue,
  Raw,
  Unless,
  Var,
  When
} from "./liquid/tags.tsx"
import { eq } from "./refs/expression.ts"
import { binding, markupBinding } from "./refs/path.ts"
import { renderValues } from "./renderValues.tsx"

/* Enough of liquidjs to resolve a bare name, which is all these paths need. */
const engine: LiquidEvaluator = {
  evalValueSync: (expression, scope) => (scope as Record<string, unknown>)[expression.trim()]
}

const greeting = binding("greeting")

describe("renderValues", () => {
  it("resolves a bound name that a later component reads", () => {
    const html = renderValues(
      () => (
        <p>
          <Assign to={greeting} value="name" />
          <Var path={greeting} />
        </p>
      ),
      { engine, values: { name: "Alex" } }
    )
    expect(html).toContain("Alex")
  })

  it("reports a bare read that ran ahead of its binding", () => {
    expect(() =>
      renderValues(
        () => (
          <p>
            <Assign to={greeting} value="name" />
            {liquidValue(greeting)}
          </p>
        ),
        { engine, values: { name: "Alex" } }
      )
    ).toThrow(/bound later in the same render/)
  })

  it("refuses to start a second render inside one already running", () => {
    expect(() => runInValueMode(engine, {}, () => runInValueMode(engine, {}, () => "inner"))).toThrow(
      /already in progress/
    )
  })

  it("reports a drop that was never supplied", () => {
    expect(() =>
      renderValues(() => <Var path={binding("tracking_number")} />, { engine, values: { name: "Alex" } })
    ).toThrow(/named nothing the template was given/)
  })

  it("accepts a drop that was supplied but left blank", () => {
    const html = renderValues(() => <Var path={binding("note")} />, { engine, values: { note: null } })
    expect(html).toBe("")
  })

  it("leaves no environment behind when a render throws", () => {
    expect(() =>
      runInValueMode(engine, {}, () => {
        throw new Error("boom")
      })
    ).toThrow("boom")
    expect(runInValueMode(engine, { name: "Alex" }, () => "ok").result).toBe("ok")
  })
})

/* Enough of liquidjs for the two shapes `Find` builds: an indexed path, and one `==` against a string. */
const read = (scope: Record<string, unknown>, path: string): unknown =>
  path
    .replaceAll("[", ".")
    .replaceAll("]", "")
    .split(".")
    .reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], scope)

const matcher: LiquidEvaluator = {
  evalValueSync: (expression, scope) => {
    const [left, right] = expression.trim().split(" == ")
    if (right === undefined) {
      return read(scope as Record<string, unknown>, left)
    }
    return read(scope as Record<string, unknown>, left) === right.slice(1, -1)
  }
}

type Item = { readonly sku: string; readonly label: string }

const items = binding<readonly Item[]>("items")

const catalogue = {
  items: [
    { sku: "A", label: "first" },
    { sku: "B", label: "second" },
    { sku: "B", label: "third" }
  ]
}

const findLabel = (sku: string) =>
  renderValues(
    () => (
      <Find each={items} match={(item) => eq(item.sku, sku)}>
        {(item) => <Var path={item.label} />}
      </Find>
    ),
    { engine: matcher, values: catalogue }
  )

describe("Find in value mode", () => {
  it("renders from the item the condition picks out", () => {
    expect(findLabel("A")).toContain("first")
  })

  it("renders nothing when the collection holds no match", () => {
    expect(findLabel("Z")).toBe("")
  })

  /* Compile mode emits no `break`, so a later match overwrites an earlier one. Both paths agree. */
  it("takes the last of several matches", () => {
    expect(findLabel("B")).toContain("third")
    expect(findLabel("B")).not.toContain("second")
  })
})

const status = binding<string>("financial_status")

const branching = (children: ReactNode) =>
  renderValues(() => <>{children}</>, { engine: matcher, values: { financial_status: "paid" } })

describe("branching in value mode", () => {
  it("renders the branch whose condition holds", () => {
    const html = branching(
      <If test={eq(status, "pending")}>
        <span>pending</span>
        <ElseIf test={eq(status, "paid")}>
          <span>paid</span>
        </ElseIf>
        <Else>
          <span>other</span>
        </Else>
      </If>
    )
    expect(html).toBe("<span>paid</span>")
  })

  it("falls through to else when no condition holds", () => {
    expect(
      branching(
        <If test={eq(status, "pending")}>
          <span>pending</span>
          <Else>
            <span>other</span>
          </Else>
        </If>
      )
    ).toBe("<span>other</span>")
  })

  it("renders nothing when the only condition fails and no else follows", () => {
    expect(
      branching(
        <If test={eq(status, "pending")}>
          <span>pending</span>
        </If>
      )
    ).toBe("")
  })

  it("negates only the first branch of an unless", () => {
    expect(
      branching(
        <Unless test={eq(status, "pending")}>
          <span>not pending</span>
        </Unless>
      )
    ).toBe("<span>not pending</span>")
    expect(
      branching(
        <Unless test={eq(status, "paid")}>
          <span>not paid</span>
          <Else>
            <span>paid after all</span>
          </Else>
        </Unless>
      )
    ).toBe("<span>paid after all</span>")
  })

  it("renders the case arm whose value matches, and nothing when none does", () => {
    const arms = [
      <When key="paid" value="paid">
        <span>settled</span>
      </When>,
      <When key="refunded" value="refunded">
        <span>returned</span>
      </When>
    ]
    expect(branching(<Case on={status}>{arms}</Case>)).toBe("<span>settled</span>")
    expect(
      branching(
        <Case on={status}>
          <When value="voided">
            <span>voided</span>
          </When>
        </Case>
      )
    ).toBe("")
  })
})

describe("looping in value mode", () => {
  const lines = binding<readonly Item[]>("items")

  const loop = (limit?: number) =>
    renderValues(
      () => (
        <For each={lines} limit={limit}>
          {(item) => (
            <span>
              <Var path={item.label} />
            </span>
          )}
        </For>
      ),
      { engine: matcher, values: catalogue }
    )

  it("renders the body once per item, addressing each by index", () => {
    expect(loop()).toBe("<span>first</span><span>second</span><span>third</span>")
  })

  it("honours a limit", () => {
    expect(loop(1)).toBe("<span>first</span>")
  })

  it("renders nothing for a name that holds no collection", () => {
    expect(
      renderValues(() => <For each={binding<readonly Item[]>("nothing")}>{(item) => <Var path={item.label} />}</For>, {
        engine: matcher,
        values: { nothing: "not a list" }
      })
    ).toBe("")
  })
})

describe("capture and raw in value mode", () => {
  it("binds rendered markup that a later read prints unescaped", () => {
    const greetingMarkup = markupBinding("greeting_markup")
    const html = renderValues(
      () => (
        <p>
          <Capture to={greetingMarkup}>
            <b>Hi</b>
          </Capture>
          <Var path={greetingMarkup} />
        </p>
      ),
      { engine, values: {} }
    )
    expect(html).toBe("<p><b>Hi</b></p>")
  })

  it("renders a raw block's children as themselves", () => {
    expect(renderValues(() => <Raw>{"{{ not_a_drop }}"}</Raw>, { engine, values: {} })).toBe("{{ not_a_drop }}")
  })
})

describe("highlighting", () => {
  const marked = (build: () => ReactElement) =>
    renderValues(build, { engine, values: { name: "Alex", note: "" }, highlight: true })

  it("marks a resolved drop so a reader can tell it from typed copy", () => {
    const html = marked(() => <Var path={binding("name")} />)
    expect(html).toContain("Alex")
    expect(html).toContain(`title="name"`)
  })

  it("shows the expression of a drop that resolved to nothing, which would otherwise be invisible", () => {
    expect(marked(() => <Var path={binding("note")} />)).toContain("note")
  })

  it("lifts an attribute drop out of the attribute it was resolved inside", () => {
    const html = marked(() => <span title={liquidValue(binding("name"))}>copy</span>)
    expect(html).toContain(`title="Alex"`)
    expect(html).toContain(`data-liquid="name"`)
  })
})

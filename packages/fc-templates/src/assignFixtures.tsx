import { Assign, binding, Capture, defineTemplate, liquidExpression, markupBinding, Var } from "@repo/shopify-emails"

/*
 * `Assign` and `Capture` bind a name that later parts of the template read. Compile mode emits the
 * tag and lets Shopify do the binding; value mode writes into the ambient environment as the render
 * passes through. These fixtures hold the two to the same result.
 *
 * The read has to be a component. A bare `liquidValue` or `liquidExpression` call is evaluated
 * while the surrounding JSX is built, which is before any sibling component renders, so it would
 * run ahead of the binding.
 */

const greeting = binding("greeting")
const label = binding("label")
const heading = markupBinding("heading")
const anchor = binding("anchor")

export const assignThenRead = defineTemplate({
  id: "assign_then_read",
  subject: () => "assign",
  render: (v) => (
    <div>
      <Assign to={greeting} value="customer.first_name | upcase" />
      <p>
        <Var path={greeting} />
      </p>
      <Var path={v.customer.first_name} />
    </div>
  )
})

export const assignRebinds = defineTemplate({
  id: "assign_rebinds",
  subject: () => "rebind",
  render: () => (
    <div>
      <Assign to={label} value="'first'" />
      <p>
        <Var path={label} />
      </p>
      <Assign to={label} value="'second'" />
      <p>
        <Var path={label} />
      </p>
    </div>
  )
})

export const captureThenRead = defineTemplate({
  id: "capture_then_read",
  subject: () => "capture",
  render: (v) => (
    <div>
      <Capture to={heading}>
        Thanks, <Var path={v.customer.first_name} />
      </Capture>
      <h1>
        <Var path={heading} />
      </h1>
    </div>
  )
})

/* The shape that cannot work, and that value mode reports rather than previewing as empty. */
export const assignReadTooEarly = defineTemplate({
  id: "assign_read_too_early",
  subject: () => "too early",
  render: () => (
    <div>
      <Assign to={anchor} value="'#top'" />
      <a href={liquidExpression("anchor")}>top</a>
    </div>
  )
})

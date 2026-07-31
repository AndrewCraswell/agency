import { defineTemplate, For, If, isTruthy, liquidExpression, liquidValue, Var } from "@repo/shopify-emails"

export const forloopInElements = defineTemplate({
  id: "forloop_in_elements",
  type: "abandonment",
  subject: () => "elements",
  render: (v) => (
    <table>
      <tbody>
        <For each={v.abandoned_visit.products_added_to_cart}>
          {(row, loop) => (
            <tr>
              <td>
                <Var path={loop.index} />
                <Var path={row.title} />
                <If test={isTruthy(loop.last)}>
                  <span>LAST</span>
                </If>
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  )
})

export const forloopInAttribute = defineTemplate({
  id: "forloop_in_attribute",
  type: "abandonment",
  subject: () => "attribute",
  render: (v) => (
    <table>
      <tbody>
        <For each={v.abandoned_visit.products_added_to_cart}>
          {(row, loop) => (
            <tr data-pos={liquidValue(loop.index)}>
              <td>
                <Var path={row.title} />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  )
})

/* Hand-written Liquid bypasses the loop ref, so it exercises the ambient binding rather than it. */
export const forloopByHand = defineTemplate({
  id: "forloop_by_hand",
  type: "abandonment",
  subject: () => "by hand",
  render: (v) => (
    <table>
      <tbody>
        <For each={v.abandoned_visit.products_added_to_cart}>
          {(row) => (
            <tr data-pos={liquidExpression("forloop.index")}>
              <td>
                <Var path={row.title} />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  )
})

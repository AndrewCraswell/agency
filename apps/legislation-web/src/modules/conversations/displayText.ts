export function displayText(value: string, maximum = 1000) {
  if (value.length <= maximum) {
    return value
  }
  let end = maximum - 1
  if (/[\uD800-\uDBFF]/.test(value[end - 1] ?? "") && /[\uDC00-\uDFFF]/.test(value[end] ?? "")) {
    end--
  }
  return `${value.slice(0, end)}…`
}

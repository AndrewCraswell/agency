export function sessionLabel(id: string, name?: string | null) {
  const suppliedName = name?.trim()
  const match = /^session:([a-z0-9-]+):([^:\s]+)$/.exec(id)
  if (suppliedName && !suppliedName.startsWith("session:") && suppliedName !== match?.[2]) {
    return suppliedName
  }
  if (!match) {
    return id
  }
  const [, jurisdiction, identifier] = match
  if (!identifier) {
    return id
  }
  if (jurisdiction === "us" && /^[1-9][0-9]{0,2}$/.test(identifier)) {
    const congress = Number(identifier)
    const lastTwo = congress % 100
    let suffix = "th"
    if (lastTwo < 11 || lastTwo > 13) {
      const suffixes: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" }
      suffix = suffixes[congress % 10] ?? "th"
    }
    return `${congress}${suffix} Congress`
  }
  const years = /^(\d{4})(\d{4})$/.exec(identifier)
  if (years && Number(years[2]) === Number(years[1]) + 1) {
    return `${years[1]}-${years[2]}`
  }
  if (/^(?:\d{4}|\d{4}-\d{4})$/.test(identifier)) {
    return identifier
  }
  return `Session ${identifier}`
}

export function sessionLabelsInText(text: string, names: ReadonlyMap<string, string> = new Map()) {
  return text.replace(/\bsession:[a-z0-9-]+:[a-zA-Z0-9_-]+/g, (id) => sessionLabel(id, names.get(id)))
}

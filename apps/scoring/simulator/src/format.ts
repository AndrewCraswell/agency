export function formatTime(atUs: number): string {
  if (atUs < 10_000 && atUs % 1000 !== 0) return `${atUs} us`
  if (atUs >= 1000) return `${(atUs / 1000).toFixed(atUs % 1000 === 0 ? 0 : 2)} ms`
  return `${atUs} us`
}

export function formatEventSpan(atUs: number): string {
  return `${Math.round(atUs / 1000)} ms`
}

export function formatWeapon(weapon: string): string {
  if (weapon === "epee") return "Epee"
  if (weapon === "foil") return "Foil"
  if (weapon === "sabre") return "Sabre"
  return weapon
}

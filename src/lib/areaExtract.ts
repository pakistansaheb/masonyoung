const SQM_RE = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*m(?:etre)?s?|sqm|m²|m2)\b/gi
const SQFT_RE = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|ft²|ft2)\b/gi

export interface AreaTotals {
  totalSqFt: number | null
  totalSqM: number | null
}

/**
 * Floor plans usually have the overall area written once, near a "Total"
 * label, alongside the room-by-room figures — so this prefers whatever sq
 * ft/sq m number appears on a line mentioning "total", and only falls back
 * to summing every area mention on the page if no such line is found
 * (summing everything when a total line exists would double-count it).
 */
export function extractAreaTotals(text: string): AreaTotals {
  const totalLines = text.split('\n').filter(l => /\btotal\b/i.test(l))
  const searchIn = totalLines.length > 0 ? totalLines.join('\n') : text

  const sqft = firstMatch(searchIn, SQFT_RE)
  const sqm = firstMatch(searchIn, SQM_RE)

  if (sqft !== null || sqm !== null) {
    return { totalSqFt: sqft, totalSqM: sqm }
  }

  // No usable "total" figure anywhere — nothing to report rather than
  // guessing by summing unrelated numbers.
  return { totalSqFt: null, totalSqM: null }
}

function firstMatch(text: string, re: RegExp): number | null {
  re.lastIndex = 0
  const m = re.exec(text)
  if (!m) return null
  return Math.round(parseFloat(m[1].replace(/,/g, '')))
}

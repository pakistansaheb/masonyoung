const SQM_RE = /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*m(?:etre)?s?|sqm|m²|m2)\b/gi
const SQFT_RE = /(\d+(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|ft²|ft2)\b/gi

/**
 * Sums every area mention found in OCR'd floor plan text (mixing sq m and
 * sq ft is fine — sq m values are converted to sq ft before summing) and
 * rounds to the nearest whole number. Returns null if no area was found.
 */
export function extractTotalSqFt(text: string): number | null {
  let total = 0
  let found = false

  for (const m of text.matchAll(SQM_RE)) {
    total += parseFloat(m[1]) * 10.7639
    found = true
  }
  for (const m of text.matchAll(SQFT_RE)) {
    total += parseFloat(m[1])
    found = true
  }

  return found ? Math.round(total) : null
}

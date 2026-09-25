const SQM_RE = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*m(?:etre)?s?|sqm|m²|m2)\b/gi
const SQFT_RE = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:sq\.?\s*ft|sqft|ft²|ft2)\b/gi

// Matches a floor label appearing anywhere in a line of OCR'd text, e.g.
// "Ground Floor Sub-Total 632 Sq Ft (58.7 Sq M)" or "2nd Floor - 400 sq ft".
const FLOOR_LABEL_RE = /(basement|lower ground floor|ground floor|mezzanine|(?:1st|first) floor|(?:2nd|second) floor|(?:3rd|third) floor|(?:4th|fourth) floor|(?:5th|fifth) floor)/i

function normaliseFloorLabel(label: string): string {
  const s = label.toLowerCase()
  if (/^(1st|first) floor$/.test(s)) return 'First Floor'
  if (/^(2nd|second) floor$/.test(s)) return 'Second Floor'
  if (/^(3rd|third) floor$/.test(s)) return 'Third Floor'
  if (/^(4th|fourth) floor$/.test(s)) return 'Fourth Floor'
  if (/^(5th|fifth) floor$/.test(s)) return 'Fifth Floor'
  return label.replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
}

export interface AreaTotals {
  totalSqFt: number | null
  totalSqM: number | null
}

export interface FloorArea {
  sqFt: number | null
  sqM: number | null
}

/**
 * Reads per-floor sub-total areas straight off OCR'd text — a photographed
 * floor schedule or RV notice usually states each floor's area on its own
 * line (e.g. "Ground Floor Sub-Total 632 Sq Ft"), rather than as a clean
 * spreadsheet table. Only lines that name a floor AND carry a sq ft/sq m
 * figure on that same line count — this avoids attributing an unrelated
 * number on a nearby line to the wrong floor.
 */
export function extractFloorAreasFromText(text: string): Record<string, FloorArea> {
  const floors: Record<string, FloorArea> = {}
  for (const line of text.split('\n')) {
    const labelMatch = line.match(FLOOR_LABEL_RE)
    if (!labelMatch) continue
    const label = normaliseFloorLabel(labelMatch[1])
    const sqFt = firstMatch(line, SQFT_RE)
    const sqM = firstMatch(line, SQM_RE)
    if (sqFt !== null || sqM !== null) {
      // First mention of a given floor wins, in case the same floor's
      // figure is repeated (e.g. once in a schedule, again in a summary).
      if (!floors[label]) floors[label] = { sqFt, sqM }
    }
  }
  return floors
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

// Reads a Rateable Value (and, where mentioned, the rating list year) off
// an attached report/notice's OCR'd or extracted text — e.g. a VOA
// business rates notice or a surveyor's report that quotes it inline.

const RV_RE = /rateable\s*value\s*(?:\(([12]\d{3})\))?[^£\d\n]{0,20}£\s*(\d[\d,]*(?:\.\d+)?)/i
const RV_SHORT_RE = /\bRV\b[^£\d\n]{0,10}£\s*(\d[\d,]*(?:\.\d+)?)/i
const RATING_LIST_YEAR_RE = /([12]\d{3})\s+rating\s+list/i

export interface RateableValueResult {
  rateableValue: string | null
  ratingYear: string | null
}

export function extractRateableValue(text: string): RateableValueResult {
  const rvMatch = text.match(RV_RE)
  if (rvMatch) {
    return { rateableValue: formatAmount(rvMatch[2]), ratingYear: rvMatch[1] ?? findYear(text) }
  }

  const shortMatch = text.match(RV_SHORT_RE)
  if (shortMatch) {
    return { rateableValue: formatAmount(shortMatch[1]), ratingYear: findYear(text) }
  }

  return { rateableValue: null, ratingYear: null }
}

function findYear(text: string): string | null {
  const m = text.match(RATING_LIST_YEAR_RE)
  return m ? m[1] : null
}

function formatAmount(raw: string): string {
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n.toLocaleString('en-GB') : raw
}

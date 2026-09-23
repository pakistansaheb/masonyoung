import * as XLSX from 'xlsx'

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return SPREADSHEET_EXTENSIONS.some(ext => name.endsWith(ext))
}

export interface FloorScheduleData {
  notes: string
  totalSqFt: number | null
}

const STRUCTURAL_LABELS = new Set([
  'sq m',
  'sq ft',
  'comments',
  'room',
  'sub - total',
  'sub-total',
  'subtotal',
  'grand total',
])

const isNumericLike = (s: string) => /^-?\d+(\.\d+)?$/.test(s)
const isDateLike = (s: string) => /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(s)
// A cell containing a UK postcode is almost always the property's own
// address (often repeated as a sheet title) — the address is already
// passed separately, so it's excluded here rather than duplicated as a note.
const isAddressLike = (s: string) => /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(s)
const isRoomLabel = (s: string) => /^room\s*\d+$/i.test(s) || /^(ground|first|second|third|basement|lower ground)\s*floor$/i.test(s)
const isStructural = (s: string) => STRUCTURAL_LABELS.has(s.toLowerCase())

/**
 * Reads a floor area schedule spreadsheet (room-by-room SQ M / SQ FT table
 * with a Comments column, and a Grand Total row) and pulls out:
 * - the descriptive notes (whatever's in the Comments column, or any other
 *   free-text cell that isn't a number, date, or structural label like
 *   "Sub - Total" / "Room 1" / "SQ FT")
 * - the total floor area in sq ft, read directly from the Grand Total row
 *   rather than summed from scattered numbers (which would double-count
 *   sub-totals)
 */
export async function extractFloorSchedule(file: File): Promise<FloorScheduleData> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = (await file.text()).trim()
    return { notes: text, totalSqFt: extractGrandTotalFromText(text) }
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const notesSet = new Set<string>()
  let totalSqFt: number | null = null

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

    for (const row of rows) {
      const cells = row.map(c => String(c ?? '').trim()).filter(Boolean)
      if (cells.length === 0) continue

      const isGrandTotalRow = cells.some(c => c.toLowerCase() === 'grand total')
      if (isGrandTotalRow) {
        const numbers = cells.filter(isNumericLike).map(Number)
        // Sq ft is always the larger figure of the sq m / sq ft pair for
        // any real room size, so take the max rather than assuming a
        // fixed column position (layouts vary between sections).
        if (numbers.length > 0) totalSqFt = Math.round(Math.max(...numbers))
        continue
      }

      for (const cell of cells) {
        if (isNumericLike(cell) || isDateLike(cell) || isRoomLabel(cell) || isStructural(cell) || isAddressLike(cell)) continue
        notesSet.add(cell)
      }
    }
  }

  return { notes: Array.from(notesSet).join('\n'), totalSqFt }
}

function extractGrandTotalFromText(text: string): number | null {
  const line = text.split('\n').find(l => /grand total/i.test(l))
  if (!line) return null
  const numbers = (line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  return numbers.length > 0 ? Math.round(Math.max(...numbers)) : null
}

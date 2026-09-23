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

const isNumericLike = (s: string) => /^-?\d+(\.\d+)?$/.test(s)
const isDateLike = (s: string) => /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(s)
const isStructural = (s: string) => ['sq m', 'sq ft', 'comments', 'room', 'sub - total', 'sub-total', 'subtotal', 'grand total'].includes(s.toLowerCase())

/**
 * Reads a floor area schedule spreadsheet (room-by-room SQ M / SQ FT table
 * with a Comments column, and a Grand Total row) and pulls out:
 * - notes: ONLY the values in the Comments column specifically (found by
 *   locating the "Comments" header cell and tracking its column position),
 *   never a room description or any other column that happens to sit next
 *   to it
 * - the total floor area in sq ft, read directly from the Grand Total row
 *   rather than summed from scattered numbers (which would double-count
 *   sub-totals)
 */
export async function extractFloorSchedule(file: File): Promise<FloorScheduleData> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = (await file.text()).trim()
    return { notes: extractCommentsColumnFromCsv(text), totalSqFt: extractGrandTotalFromText(text) }
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const notesSet = new Set<string>()
  let totalSqFt: number | null = null

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })

    let commentsColIndex: number | null = null

    for (const rawRow of rows) {
      // Array.from densifies: sheet_to_json rows can have sparse "holes"
      // for empty cells, which .map() silently skips but .findIndex()
      // does not (it visits every index and passes undefined for holes).
      const cells = Array.from(rawRow, c => (c == null ? '' : String(c).trim()))
      if (cells.every(c => !c)) continue

      // A header row (repeats per section in these schedules) — (re)locate
      // the Comments column; layouts can shift between sections.
      const headerIdx = cells.findIndex(c => c.toLowerCase() === 'comments')
      if (headerIdx !== -1) {
        commentsColIndex = headerIdx
        continue
      }

      if (cells.some(c => c.toLowerCase() === 'grand total')) {
        const numbers = cells.filter(isNumericLike).map(Number)
        // Sq ft is always the larger of the sq m / sq ft pair, so take the
        // max rather than assuming a fixed column position.
        if (numbers.length > 0) totalSqFt = Math.round(Math.max(...numbers))
        continue
      }

      if (commentsColIndex === null) continue
      const cell = cells[commentsColIndex]
      if (cell && !isNumericLike(cell) && !isDateLike(cell) && !isStructural(cell)) {
        notesSet.add(cell)
      }
    }
  }

  return { notes: Array.from(notesSet).join('\n'), totalSqFt }
}

function extractCommentsColumnFromCsv(text: string): string {
  const rows = text.split('\n').map(line => line.split(',').map(c => c.trim()))
  let commentsColIndex: number | null = null
  const notes: string[] = []

  for (const cells of rows) {
    if (cells.every(c => !c)) continue
    const headerIdx = cells.findIndex(c => c.toLowerCase() === 'comments')
    if (headerIdx !== -1) {
      commentsColIndex = headerIdx
      continue
    }
    if (cells.some(c => c.toLowerCase() === 'grand total')) continue
    if (commentsColIndex === null) continue
    const cell = cells[commentsColIndex]
    if (cell && !isNumericLike(cell) && !isDateLike(cell) && !isStructural(cell)) notes.push(cell)
  }

  return notes.join('\n')
}

function extractGrandTotalFromText(text: string): number | null {
  const line = text.split('\n').find(l => /grand total/i.test(l))
  if (!line) return null
  const numbers = (line.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  return numbers.length > 0 ? Math.round(Math.max(...numbers)) : null
}

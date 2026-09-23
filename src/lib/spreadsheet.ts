import * as XLSX from 'xlsx'

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return SPREADSHEET_EXTENSIONS.some(ext => name.endsWith(ext))
}

export interface FloorArea {
  sqFt: number | null
  sqM: number | null
}

export interface FloorScheduleData {
  notes: string
  totalSqFt: number | null
  totalSqM: number | null
  /** Per-floor sub-totals, keyed by normalised floor label (e.g. "Ground Floor", "First Floor"). */
  floors: Record<string, FloorArea>
}

const isNumericLike = (s: string) => /^-?\d+(\.\d+)?$/.test(s)
const isDateLike = (s: string) => /^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(s)
const isStructural = (s: string) => ['sq m', 'sq ft', 'comments', 'room', 'sub - total', 'sub-total', 'subtotal', 'grand total'].includes(s.toLowerCase())

// Matches a standalone floor-section label cell, e.g. "Ground Floor",
// "First Floor", "2nd Floor" — used to know which floor the next
// "Sub - Total" row's figures belong to.
const FLOOR_LABEL_RE =
  /^(basement|lower ground floor|ground floor|mezzanine|(?:1st|first) floor|(?:2nd|second) floor|(?:3rd|third) floor|(?:4th|fourth) floor|(?:5th|fifth) floor)$/i

function normaliseFloorLabel(label: string): string {
  const s = label.toLowerCase()
  if (/^(1st|first) floor$/.test(s)) return 'First Floor'
  if (/^(2nd|second) floor$/.test(s)) return 'Second Floor'
  if (/^(3rd|third) floor$/.test(s)) return 'Third Floor'
  if (/^(4th|fourth) floor$/.test(s)) return 'Fourth Floor'
  if (/^(5th|fifth) floor$/.test(s)) return 'Fifth Floor'
  return label.replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase())
}

interface ColumnTracker {
  comments: number | null
  sqm: number | null
  sqft: number | null
}

/**
 * Reads a floor area schedule spreadsheet (room-by-room SQ M / SQ FT table
 * with a Comments column, and a Grand Total row) and pulls out:
 * - notes: ONLY the values in the Comments column specifically (found by
 *   locating the "Comments" header cell and tracking its column position),
 *   never a room description or any other column that happens to sit next
 *   to it
 * - the total floor area, in BOTH sq ft and sq m, read directly from the
 *   exact "SQ FT"/"SQ M" columns of the Grand Total row (by column
 *   position, not by guessing which number is bigger) rather than summed
 *   from scattered numbers, which would double-count sub-totals
 */
export async function extractFloorSchedule(file: File): Promise<FloorScheduleData> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const rows = (await file.text()).trim().split('\n').map(line => line.split(',').map(c => c.trim()))
    return extractFromRows(rows)
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const notesSet = new Set<string>()
  let totalSqFt: number | null = null
  let totalSqM: number | null = null
  const floors: Record<string, FloorArea> = {}

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false }).map(rawRow =>
      // Array.from densifies: sheet_to_json rows can have sparse "holes"
      // for empty cells, which .map() silently skips but .findIndex()
      // does not (it visits every index and passes undefined for holes).
      Array.from(rawRow, c => (c == null ? '' : String(c).trim()))
    )
    const result = extractFromRows(rows)
    for (const n of result.notes.split('\n')) if (n) notesSet.add(n)
    if (result.totalSqFt !== null) totalSqFt = result.totalSqFt
    if (result.totalSqM !== null) totalSqM = result.totalSqM
    Object.assign(floors, result.floors)
  }

  return { notes: Array.from(notesSet).join('\n'), totalSqFt, totalSqM, floors }
}

function extractFromRows(rows: string[][]): FloorScheduleData {
  const cols: ColumnTracker = { comments: null, sqm: null, sqft: null }
  const notes: string[] = []
  const floors: Record<string, FloorArea> = {}
  let totalSqFt: number | null = null
  let totalSqM: number | null = null
  let currentFloor: string | null = null

  for (const cells of rows) {
    if (cells.every(c => !c)) continue

    // A header row (these schedules repeat one per section) — (re)locate
    // each column; layouts can shift between sections.
    const commentsIdx = cells.findIndex(c => c.toLowerCase() === 'comments')
    const sqmIdx = cells.findIndex(c => c.toLowerCase() === 'sq m')
    const sqftIdx = cells.findIndex(c => c.toLowerCase() === 'sq ft')
    if (commentsIdx !== -1 || sqmIdx !== -1 || sqftIdx !== -1) {
      if (commentsIdx !== -1) cols.comments = commentsIdx
      if (sqmIdx !== -1) cols.sqm = sqmIdx
      if (sqftIdx !== -1) cols.sqft = sqftIdx
      continue
    }

    // A standalone floor-section label, e.g. "Ground Floor" — remember it
    // so the next "Sub - Total" row's figures can be attributed to it.
    const floorLabelCell = cells.find(c => FLOOR_LABEL_RE.test(c))
    if (floorLabelCell && cells.filter(Boolean).length === 1) {
      currentFloor = normaliseFloorLabel(floorLabelCell)
      continue
    }

    if (cells.some(c => /^sub\s*-?\s*total$/i.test(c))) {
      if (currentFloor) {
        const sqftCell = cols.sqft !== null ? cells[cols.sqft] : undefined
        const sqmCell = cols.sqm !== null ? cells[cols.sqm] : undefined
        floors[currentFloor] = {
          sqFt: sqftCell && isNumericLike(sqftCell) ? Math.round(Number(sqftCell)) : null,
          sqM: sqmCell && isNumericLike(sqmCell) ? Math.round(Number(sqmCell)) : null,
        }
      }
      continue
    }

    if (cells.some(c => c.toLowerCase() === 'grand total')) {
      const sqftCell = cols.sqft !== null ? cells[cols.sqft] : undefined
      const sqmCell = cols.sqm !== null ? cells[cols.sqm] : undefined
      if (sqftCell && isNumericLike(sqftCell)) totalSqFt = Math.round(Number(sqftCell))
      if (sqmCell && isNumericLike(sqmCell)) totalSqM = Math.round(Number(sqmCell))
      continue
    }

    if (cols.comments === null) continue
    const cell = cells[cols.comments]
    if (cell && !isNumericLike(cell) && !isDateLike(cell) && !isStructural(cell)) {
      notes.push(cell)
    }
  }

  return { notes: notes.join('\n'), totalSqFt, totalSqM, floors }
}

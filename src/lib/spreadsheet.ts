import * as XLSX from 'xlsx'

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return SPREADSHEET_EXTENSIONS.some(ext => name.endsWith(ext))
}

/**
 * Pulls every non-empty cell out of a spreadsheet floor plan schedule as
 * plain text lines. Handles both legacy .xls (binary) and modern .xlsx
 * (zip-based) formats, plus .csv, via SheetJS.
 */
export async function extractSpreadsheetText(file: File): Promise<string> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    return (await file.text()).trim()
  }

  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const lines: string[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false })
    for (const row of rows) {
      const cells = row.map(c => String(c ?? '').trim()).filter(Boolean)
      if (cells.length) lines.push(cells.join(' — '))
    }
  }

  return lines.join('\n')
}

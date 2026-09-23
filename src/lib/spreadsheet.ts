import ExcelJS from 'exceljs'

const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.csv']

export function isSpreadsheetFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return SPREADSHEET_EXTENSIONS.some(ext => name.endsWith(ext))
}

/** Pulls every non-empty cell out of a spreadsheet floor plan schedule as plain text lines. */
export async function extractSpreadsheetText(file: File): Promise<string> {
  const name = file.name.toLowerCase()

  if (name.endsWith('.csv')) {
    return (await file.text()).trim()
  }

  const buffer = await file.arrayBuffer()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const lines: string[] = []
  workbook.eachSheet(sheet => {
    sheet.eachRow(row => {
      const values = (row.values as unknown[]).slice(1)
      const cells = values
        .map(v => (v == null ? '' : typeof v === 'object' && 'text' in v ? String((v as { text: unknown }).text) : String(v)))
        .map(s => s.trim())
        .filter(Boolean)
      if (cells.length) lines.push(cells.join(' — '))
    })
  })

  return lines.join('\n')
}

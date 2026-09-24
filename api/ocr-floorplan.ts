// Reads text off an attached floor plan photo/scan using OCR.space,
// so surveyor's notes on the image get pulled into the app automatically.

import type { IncomingMessage, ServerResponse } from 'http'

export const maxDuration = 30

// The uploaded image comes through as a raw binary body, not JSON — turn
// off Vercel's automatic body parsing so we get the untouched bytes.
export const config = { api: { bodyParser: false } }

function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: IncomingMessage & { url?: string; headers: Record<string, string | undefined> }, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    return send(res, 500, { error: 'OCR_SPACE_API_KEY is not configured on the server' })
  }

  const url = new URL(req.url ?? '', 'http://localhost')
  const filename = url.searchParams.get('filename') || 'upload.jpg'
  const contentType = req.headers['content-type'] || 'image/jpeg'
  // A floor plan drawing has notes written in a side margin, separate from
  // the room labels scattered across the drawing — worth isolating. A PDF
  // report is normal flowing text with no such margin, so that heuristic
  // would wrongly discard most of it; ?mode=report returns everything.
  const isReport = url.searchParams.get('mode') === 'report'

  try {
    const bytes = await readRawBody(req)
    const form = new FormData()
    form.append('apikey', apiKey)
    form.append('language', 'eng')
    form.append('OCREngine', '2')
    form.append('isOverlayRequired', 'true')
    if (contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
      form.append('filetype', 'PDF')
    }
    form.append('file', new Blob([new Uint8Array(bytes)], { type: contentType }), filename)

    const ocrRes = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(25000),
    })

    if (!ocrRes.ok) {
      const text = await ocrRes.text()
      throw new Error(`OCR.space error ${ocrRes.status}: ${text}`)
    }

    const json = (await ocrRes.json()) as {
      IsErroredOnProcessing?: boolean
      ErrorMessage?: string[] | string
      ParsedResults?: { ParsedText: string; TextOverlay?: { Lines?: Line[] } }[]
    }

    if (json.IsErroredOnProcessing) {
      const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(', ') : json.ErrorMessage
      throw new Error(msg || 'OCR.space failed to process the image')
    }

    const text = isReport
      ? (json.ParsedResults ?? []).map(r => r.ParsedText).join('\n').trim()
      : extractNotesFromOverlay(json.ParsedResults ?? [])

    send(res, 200, { text })
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : 'OCR failed' })
  }
}

interface Word {
  WordText: string
  Left: number
  Top: number
  Width: number
}
interface Line {
  LineText: string
  Words: Word[]
}
interface ParsedResult {
  ParsedText: string
  TextOverlay?: { Lines?: Line[] }
}

/**
 * Floor plan notes are conventionally handwritten/typed in a column down
 * the left margin of the sheet, separate from the dimension labels and
 * room names scattered across the drawing itself. Using the OCR overlay's
 * word positions, this isolates lines whose leftmost word sits in roughly
 * the left third of the page and returns those preferentially — falling
 * back to the full parsed text if position data isn't available or
 * nothing was found in that margin.
 */
function extractNotesFromOverlay(results: ParsedResult[]): string {
  const allLines = results.flatMap(r => r.TextOverlay?.Lines ?? [])
  const fullText = results.map(r => r.ParsedText).join('\n').trim()

  if (allLines.length === 0) return fullText

  let pageWidth = 0
  for (const line of allLines) {
    for (const w of line.Words) pageWidth = Math.max(pageWidth, w.Left + w.Width)
  }
  if (pageWidth === 0) return fullText

  const leftThreshold = pageWidth * 0.35
  const marginLines = allLines
    .map(line => ({
      text: line.LineText,
      top: Math.min(...line.Words.map(w => w.Top)),
      left: Math.min(...line.Words.map(w => w.Left)),
    }))
    .filter(l => l.left < leftThreshold && l.text.trim())
    .sort((a, b) => a.top - b.top)
    .map(l => l.text.trim())

  return marginLines.length > 0 ? marginLines.join('\n') : fullText
}


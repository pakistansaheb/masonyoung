// Reads text off an attached floor plan photo/scan using OCR.space,
// so surveyor's notes on the image get pulled into the app automatically.

export const maxDuration = 30

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.OCR_SPACE_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OCR_SPACE_API_KEY is not configured on the server' }), { status: 500 })
  }

  const url = new URL(req.url)
  const filename = url.searchParams.get('filename') || 'upload.jpg'
  const contentType = req.headers.get('content-type') || 'image/jpeg'

  try {
    const bytes = await req.arrayBuffer()
    const form = new FormData()
    form.append('apikey', apiKey)
    form.append('language', 'eng')
    form.append('OCREngine', '2')
    form.append('isOverlayRequired', 'true')
    form.append('file', new Blob([bytes], { type: contentType }), filename)

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OCR.space error ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      IsErroredOnProcessing?: boolean
      ErrorMessage?: string[] | string
      ParsedResults?: { ParsedText: string; TextOverlay?: { Lines?: Line[] } }[]
    }

    if (json.IsErroredOnProcessing) {
      const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(', ') : json.ErrorMessage
      throw new Error(msg || 'OCR.space failed to process the image')
    }

    const text = extractNotesFromOverlay(json.ParsedResults ?? [])

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'OCR failed' }), { status: 502 })
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


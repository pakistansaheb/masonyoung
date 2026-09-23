// Reads text off an attached floor plan photo/scan using OCR.space,
// so surveyor's notes on the image get pulled into the app automatically.

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
    form.append('file', new Blob([bytes], { type: contentType }), filename)

    const res = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: form,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OCR.space error ${res.status}: ${text}`)
    }

    const json = (await res.json()) as {
      IsErroredOnProcessing?: boolean
      ErrorMessage?: string[] | string
      ParsedResults?: { ParsedText: string }[]
    }

    if (json.IsErroredOnProcessing) {
      const msg = Array.isArray(json.ErrorMessage) ? json.ErrorMessage.join(', ') : json.ErrorMessage
      throw new Error(msg || 'OCR.space failed to process the image')
    }

    const text = json.ParsedResults?.map(r => r.ParsedText).join('\n').trim() ?? ''

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'OCR failed' }), { status: 502 })
  }
}

export const config = { runtime: 'edge' }

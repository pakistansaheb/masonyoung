import type { IncomingMessage, ServerResponse } from 'http'
import { put } from '@vercel/blob'

// Accepts the generated .docx bytes from the browser, stores it as a
// short-lived Blob, and returns a public URL Word can fetch from.

// The .docx comes through as a raw binary body, not JSON — turn off
// Vercel's automatic body parsing so we get the untouched bytes.
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

export default async function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' })
  }

  const url = new URL(req.url ?? '', 'http://localhost')
  const filename = url.searchParams.get('filename') || `report-${Date.now()}.docx`

  try {
    const bytes = await readRawBody(req)
    const blob = await put(`drafts/${Date.now()}-${filename}`, bytes, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      addRandomSuffix: true,
    })
    send(res, 200, { url: blob.url })
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : 'Upload failed' })
  }
}

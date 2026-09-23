import { put } from '@vercel/blob'

// Accepts the generated .docx bytes from the browser, stores it as a
// short-lived Blob, and returns a public URL Word can fetch from.
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const url = new URL(req.url)
  const filename = url.searchParams.get('filename') || `report-${Date.now()}.docx`

  try {
    const bytes = await req.arrayBuffer()
    const blob = await put(`drafts/${Date.now()}-${filename}`, bytes, {
      access: 'public',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      addRandomSuffix: true,
    })
    return new Response(JSON.stringify({ url: blob.url }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Upload failed' }), { status: 502 })
  }
}

export const config = { runtime: 'edge' }

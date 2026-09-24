// Temporary diagnostic endpoint — reports whether server-side env vars are
// actually reaching this deployment's serverless functions, without ever
// exposing the values themselves. Delete this once the OCR_SPACE_API_KEY
// deployment issue is resolved.

import type { IncomingMessage, ServerResponse } from 'http'

export default async function handler(_req: IncomingMessage, res: ServerResponse) {
  const describe = (name: string) => {
    const v = process.env[name]
    return {
      present: !!v,
      length: v ? v.length : 0,
      // First/last char only, so a typo'd leading/trailing space or quote
      // is visible without revealing the key.
      preview: v ? `${v[0]}...${v[v.length - 1]}` : null,
    }
  }

  res.statusCode = 200
  res.setHeader('content-type', 'application/json')
  res.end(
    JSON.stringify(
      {
        OCR_SPACE_API_KEY: describe('OCR_SPACE_API_KEY'),
        GROQ_API_KEY: describe('GROQ_API_KEY'),
        VERCEL_ENV: process.env.VERCEL_ENV ?? null,
        VERCEL_URL: process.env.VERCEL_URL ?? null,
      },
      null,
      2
    )
  )
}

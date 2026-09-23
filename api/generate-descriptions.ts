// Vercel serverless function (classic Node.js req/res signature).
// Generates the Location Description and Property Description for a
// Mason Young disposal report, following the firm's exact house style.

import type { IncomingMessage, ServerResponse } from 'http'

interface RequestBody {
  address: string
  floorPlanNotes: string
}

const LOCATION_SYSTEM = `You write location descriptions for Mason Young Property Consultants marketing appraisal reports.

Rules, strictly followed:
- Do not compliment the property's location. Purely describe the location, nothing else.
- Do not mention businesses being successful or similar commentary.
- Cover, in this exact order, only where applicable: (1) where the property is situated, (2) what main road(s) it gives access to by name (skip this if the property already sits directly on a main road), (3) the nearest arterial route, (4) how far the nearest motorway is, (5) how far the nearest train station is, (6) how far the nearest city centre is.
- CRITICAL: never invent or guess a specific fact you are not genuinely confident about — a road name, a distance, a station name, a junction number. If you don't know a specific fact for this address with real confidence, leave that point out of the description entirely rather than writing something plausible-sounding. An omitted fact is fine; a wrong or made-up one is not.
- Write it as continuous prose (3-6 sentences), not a list.
- Output ONLY the location description text, nothing else — no preamble, no heading.

Example of the exact tone and structure required:
"The property is located on Constitution Hill, a main arterial route, at the northern edge of Birmingham City Centre. This position places it within the historical and commercially active Jewellery Quarter. It is situated close to the intersection of Constitution Hill and Livery Street. Transport links are readily available via St Paul's West Midlands Metro Tram Stop, located virtually opposite the premises. Birmingham Snow Hill Railway Station is also within a short walking distance, offering mainline rail services. The location provides road access to the A38(M) Aston Expressway and the wider Midlands Motorway network."`

const PROPERTY_SYSTEM = `You write property descriptions for Mason Young Property Consultants marketing appraisal reports, using a surveyor's on-site notes.

Rules, strictly followed:
- Do not compliment the property. Purely describe the property and what it benefits from.
- Do not mention businesses being successful or similar commentary.
- Cover, in this exact order: (1) how the property is situated/constructed — a building-type and construction sentence that MUST include the roof type (e.g. "the property comprises of an end terrace two storey building of brick built construction surmounted by a pitched tiled roof"), (2) how it is set out internally, benefits listed from the ground up: floor, walls, then ceiling/lighting, then fixtures (kitchen, WCs, etc.), (3) what it benefits from externally.
- The surveyor's on-site notes are the primary source of truth for this description — every distinct item mentioned in them (each floor finish, wall type, light fitting, fixture, external feature) MUST be reflected somewhere in the description. Do not skip or summarise away anything listed in the notes.
- CRITICAL: only state specific fixtures, materials, or construction details that are either given in the surveyor's notes or are safe, generic defaults (e.g. "plastered and painted walls"). Never invent a specific detail (an exact roof type, a specific fixture) that isn't supported by the notes — if the notes don't mention it, describe that aspect only in general terms or leave it out rather than guessing.
- Write it as continuous prose (3-5 sentences), not a list.
- Output ONLY the property description text, nothing else — no preamble, no heading.

Example of the exact tone and structure required:
"The property comprises of an end terrace two storey building of brick built construction surmounted by a pitched tiled roof. Internally, the ground floor premises benefit from solid floor with tiled covering, part plastered and painted and part tiled walls, suspended ceiling with LED lights, fluorescent strip lights, stainless steel kitchen, extraction canopy and WC facilities. Externally, the property benefits from an electric metal roller shutter."`

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function callGroq(system: string, userMessage: string, apiKey: string, retriesLeft = 2): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (res.status === 429 && retriesLeft > 0) {
    const retryAfterHeader = res.headers.get('retry-after')
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN
    const waitMs = Number.isFinite(retryAfterMs) ? retryAfterMs : (3 - retriesLeft) * 5000
    await sleep(waitMs)
    return callGroq(system, userMessage, apiKey, retriesLeft - 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq API error ${res.status}: ${text}`)
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] }
  return json.choices[0]?.message?.content?.trim() ?? ''
}

// Vercel's default function execution limit (10s on Hobby) is shorter than
// our 20s per-call Mistral timeout, which was silently killing the request
// before Mistral could respond. Raised further to give 429 retry backoff
// room across two sequential calls.
export const maxDuration = 60

function send(res: ServerResponse, status: number, body: object) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return send(res, 500, { error: 'GROQ_API_KEY is not configured on the server' })
  }

  const body = req.body as RequestBody | undefined
  if (!body || typeof body !== 'object') {
    return send(res, 400, { error: 'Invalid JSON body' })
  }

  const { address, floorPlanNotes } = body
  if (!address?.trim()) {
    return send(res, 400, { error: 'address is required' })
  }

  try {
    const location = await callGroq(LOCATION_SYSTEM, `ADDRESS: ${address}`, apiKey)
    const property = await callGroq(
      PROPERTY_SYSTEM,
      `ADDRESS: ${address}\n\nSurveyor's on-site notes (from the floor plan / site visit):\n${floorPlanNotes?.trim() || '(no notes provided — use only general, non-specific phrasing and leave fixture details generic)'}`,
      apiKey
    )

    send(res, 200, { location, property })
  } catch (err) {
    send(res, 502, { error: err instanceof Error ? err.message : 'Unknown error' })
  }
}


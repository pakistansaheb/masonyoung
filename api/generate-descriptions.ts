// Vercel serverless function (Node runtime).
// Generates the Location Description and Property Description for a
// Mason Young disposal report, following the firm's exact house style.

interface RequestBody {
  address: string
  floorPlanNotes: string
}

const LOCATION_SYSTEM = `You write location descriptions for Mason Young Property Consultants marketing appraisal reports.

Rules, strictly followed:
- Do not compliment the property's location. Purely describe the location, nothing else.
- Do not mention businesses being successful or similar commentary.
- Cover, in this exact order, only where applicable: (1) where the property is situated, (2) what main road(s) it gives access to by name (skip this if the property already sits directly on a main road), (3) the nearest arterial route, (4) how far the nearest motorway is, (5) how far the nearest train station is, (6) how far the nearest city centre is.
- Write it as continuous prose (3-6 sentences), not a list.
- Output ONLY the location description text, nothing else — no preamble, no heading.

Example of the exact tone and structure required:
"The property is located on Constitution Hill, a main arterial route, at the northern edge of Birmingham City Centre. This position places it within the historical and commercially active Jewellery Quarter. It is situated close to the intersection of Constitution Hill and Livery Street. Transport links are readily available via St Paul's West Midlands Metro Tram Stop, located virtually opposite the premises. Birmingham Snow Hill Railway Station is also within a short walking distance, offering mainline rail services. The location provides road access to the A38(M) Aston Expressway and the wider Midlands Motorway network."`

const PROPERTY_SYSTEM = `You write property descriptions for Mason Young Property Consultants marketing appraisal reports, using a surveyor's on-site notes.

Rules, strictly followed:
- Do not compliment the property. Purely describe the property and what it benefits from.
- Do not mention businesses being successful or similar commentary.
- Cover, in this exact order: (1) how the property is situated/constructed — a building-type and construction sentence that MUST include the roof type (e.g. "the property comprises of an end terrace two storey building of brick built construction surmounted by a pitched tiled roof"), (2) how it is set out internally, benefits listed from the ground up: floor, walls, then ceiling/lighting, then fixtures (kitchen, WCs, etc.), (3) what it benefits from externally.
- Weave in the surveyor's on-site notes provided as the specific benefits/fixtures for that property — treat them as things this property consists of.
- Write it as continuous prose (3-5 sentences), not a list.
- Output ONLY the property description text, nothing else — no preamble, no heading.

Example of the exact tone and structure required:
"The property comprises of an end terrace two storey building of brick built construction surmounted by a pitched tiled roof. Internally, the ground floor premises benefit from solid floor with tiled covering, part plastered and painted and part tiled walls, suspended ceiling with LED lights, fluorescent strip lights, stainless steel kitchen, extraction canopy and WC facilities. Externally, the property benefits from an electric metal roller shutter."`

async function callClaude(system: string, userMessage: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API error ${res.status}: ${text}`)
  }

  const json = (await res.json()) as { content: { type: string; text?: string }[] }
  const textBlock = json.content.find(b => b.type === 'text')
  return textBlock?.text?.trim() ?? ''
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server' }), { status: 500 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const { address, floorPlanNotes } = body
  if (!address?.trim()) {
    return new Response(JSON.stringify({ error: 'address is required' }), { status: 400 })
  }

  try {
    const [location, property] = await Promise.all([
      callClaude(LOCATION_SYSTEM, `ADDRESS: ${address}`, apiKey),
      callClaude(
        PROPERTY_SYSTEM,
        `ADDRESS: ${address}\n\nSurveyor's on-site notes (from the floor plan / site visit):\n${floorPlanNotes?.trim() || '(no notes provided — use only general, non-specific phrasing and leave fixture details generic)'}`,
        apiKey
      ),
    ])

    return new Response(JSON.stringify({ location, property }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), { status: 502 })
  }
}

export const config = { runtime: 'edge' }

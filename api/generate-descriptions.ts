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

async function callMistral(system: string, userMessage: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mistral-small-latest',
      max_tokens: 500,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Mistral API error ${res.status}: ${text}`)
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] }
  return json.choices[0]?.message?.content?.trim() ?? ''
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'MISTRAL_API_KEY is not configured on the server' }), { status: 500 })
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
      callMistral(LOCATION_SYSTEM, `ADDRESS: ${address}`, apiKey),
      callMistral(
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


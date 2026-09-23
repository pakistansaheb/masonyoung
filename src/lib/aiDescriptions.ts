export interface GeneratedDescriptions {
  location: string
  property: string
}

export async function generateDescriptions(address: string, floorPlanNotes: string): Promise<GeneratedDescriptions> {
  let res: Response
  try {
    res = await fetch('/api/generate-descriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, floorPlanNotes }),
      signal: AbortSignal.timeout(30000),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      throw new Error('Took too long to respond (30s) — try again.')
    }
    throw err
  }

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as GeneratedDescriptions
}

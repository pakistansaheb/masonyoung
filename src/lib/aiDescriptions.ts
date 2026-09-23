export interface GeneratedDescriptions {
  location: string
  property: string
}

export async function generateDescriptions(address: string, floorPlanNotes: string): Promise<GeneratedDescriptions> {
  const res = await fetch('/api/generate-descriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, floorPlanNotes }),
  })

  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`)
  }
  return json as GeneratedDescriptions
}

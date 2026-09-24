export async function ocrFloorPlan(file: File, mode?: 'report'): Promise<string> {
  const modeParam = mode ? `&mode=${mode}` : ''
  const res = await fetch(`/api/ocr-floorplan?filename=${encodeURIComponent(file.name)}${modeParam}`, {
    method: 'POST',
    headers: { 'content-type': file.type || 'application/octet-stream' },
    body: file,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || `OCR request failed (${res.status})`)
  return json.text as string
}

import { useState } from 'react'
import { Upload, Sparkles, FileDown, Loader2, Image as ImageIcon, X } from 'lucide-react'
import StepCard from '../PropertyReports/StepCard'
import { TextField, TextAreaField } from '../PropertyReports/fields'
import { BLANK_BROCHURE, BULLET_SUGGESTIONS, type BrochureData, type BrochureDisposalType } from './types'
import { generateDescriptions } from '../../lib/aiDescriptions'
import { generateBrochureDocx, downloadBrochureDocx } from '../../lib/brochureGenerator'
import { computeRatesPayable, formatCurrency } from '../../lib/brochureBoilerplate'
import { ocrFloorPlan } from '../../lib/ocr'
import { extractAreaTotals } from '../../lib/areaExtract'
import { extractRateableValue } from '../../lib/rateableValueExtract'
import { isSpreadsheetFile, extractFloorSchedule, type FloorArea } from '../../lib/spreadsheet'

const DISPOSAL_OPTIONS: { key: BrochureDisposalType; title: string; desc: string }[] = [
  { key: 'freehold', title: 'For Sale', desc: 'Freehold disposal' },
  { key: 'leasehold', title: 'To Let', desc: 'Leasehold letting' },
  { key: 'lease_assignment', title: 'Lease For Sale', desc: 'Assignment of an existing lease' },
]

export default function PropertyBrochures() {
  const [data, setData] = useState<BrochureData>(BLANK_BROCHURE)
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [building, setBuilding] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrError, setOcrError] = useState('')

  function set<K extends keyof BrochureData>(key: K, value: BrochureData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function suggestBullets() {
    set('bullets', BULLET_SUGGESTIONS[data.disposalType])
  }

  function setBullet(i: number, value: string) {
    const next = [...data.bullets]
    next[i] = value
    set('bullets', next)
  }

  function addBullet() {
    set('bullets', [...data.bullets, ''])
  }

  function removeBullet(i: number) {
    set('bullets', data.bullets.filter((_, idx) => idx !== i))
  }

  // Same auto-calculation as Property Reports, broadened to also accept a
  // full report (PDF) rather than only a floor plan drawing, AND to accept
  // several attachments at once (a floor plan, a general report, an RV/
  // business rates notice — whatever's available). Each attachment's text
  // is read (a floor plan image's notes from its side margin, a PDF report
  // in full), scanned for area figures and a Rateable Value, and appended
  // into the combined Property Notes field below — which is what actually
  // drives the AI property description, and stays visible/editable so it's
  // clear exactly what's feeding it.
  async function onFilesChosen(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    if (!data.floorPlanFile) set('floorPlanFile', files.find(f => f.type.startsWith('image/')) ?? files[0])

    setOcrError('')
    setOcrRunning(true)
    try {
      let combinedNotes = ''
      let sqFt: number | null = null
      let sqM: number | null = null
      let floors: Record<string, FloorArea> = {}
      let rateableValue: string | null = null
      let ratingYear: string | null = null

      for (const file of files) {
        const isImage = file.type.startsWith('image/')
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        const isSpreadsheet = isSpreadsheetFile(file)
        if (!isImage && !isPdf && !isSpreadsheet) continue

        const ocrText = isImage ? await ocrFloorPlan(file) : isPdf ? await ocrFloorPlan(file, 'report') : ''
        if (ocrText.trim()) {
          combinedNotes += (combinedNotes ? '\n\n' : '') + ocrText.trim()
        }
        const schedule = isSpreadsheet ? await extractFloorSchedule(file) : null
        const totals = extractAreaTotals(ocrText)
        if (schedule?.totalSqFt != null) sqFt = schedule.totalSqFt
        else if (sqFt === null && totals.totalSqFt !== null) sqFt = totals.totalSqFt
        if (schedule?.totalSqM != null) sqM = schedule.totalSqM
        else if (sqM === null && totals.totalSqM !== null) sqM = totals.totalSqM
        if (schedule?.floors) floors = { ...floors, ...schedule.floors }
        const rv = extractRateableValue(ocrText)
        if (rv.rateableValue) rateableValue = rv.rateableValue
        if (rv.ratingYear) ratingYear = rv.ratingYear
      }

      const knownFloors = new Set(['Ground Floor', 'First Floor', 'Second Floor'])
      const otherFloors = Object.entries(floors).filter(([label]) => !knownFloors.has(label))
      const otherSqFt = otherFloors.reduce((sum, [, a]) => (a.sqFt !== null ? sum + a.sqFt : sum), 0)
      const otherSqM = otherFloors.reduce((sum, [, a]) => (a.sqM !== null ? sum + a.sqM : sum), 0)

      setData(prev => ({
        ...prev,
        floorPlanNotes: combinedNotes ? (prev.floorPlanNotes ? `${prev.floorPlanNotes}\n\n${combinedNotes}` : combinedNotes) : prev.floorPlanNotes,
        totalSqFt: sqFt !== null ? String(sqFt) : prev.totalSqFt,
        totalSqM: sqM !== null ? String(sqM) : prev.totalSqM,
        groundFloorSqFt: floors['Ground Floor']?.sqFt != null ? String(floors['Ground Floor'].sqFt) : prev.groundFloorSqFt,
        groundFloorSqM: floors['Ground Floor']?.sqM != null ? String(floors['Ground Floor'].sqM) : prev.groundFloorSqM,
        firstFloorSqFt: floors['First Floor']?.sqFt != null ? String(floors['First Floor'].sqFt) : prev.firstFloorSqFt,
        firstFloorSqM: floors['First Floor']?.sqM != null ? String(floors['First Floor'].sqM) : prev.firstFloorSqM,
        secondFloorSqFt: floors['Second Floor']?.sqFt != null ? String(floors['Second Floor'].sqFt) : prev.secondFloorSqFt,
        secondFloorSqM: floors['Second Floor']?.sqM != null ? String(floors['Second Floor'].sqM) : prev.secondFloorSqM,
        otherFloorSqFt: otherSqFt ? String(otherSqFt) : prev.otherFloorSqFt,
        otherFloorSqM: otherSqM ? String(otherSqM) : prev.otherFloorSqM,
        rateableValue: rateableValue ?? prev.rateableValue,
        ratingYear: ratingYear ?? prev.ratingYear,
      }))
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Could not read one of the attachments — fill in the areas and notes manually.')
    } finally {
      setOcrRunning(false)
    }
  }

  async function handleGenerateDescriptions() {
    if (!data.address.trim()) {
      setAiError('Enter the property address first (Step 2).')
      return
    }
    setAiError('')
    setGenerating(true)
    try {
      const { location, property } = await generateDescriptions(data.address, data.floorPlanNotes)
      setData(prev => ({ ...prev, locationDescription: location, propertyDescription: property }))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate descriptions')
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    setBuilding(true)
    try {
      const { blob, filename } = await generateBrochureDocx(data)
      downloadBrochureDocx(blob, filename)
    } finally {
      setBuilding(false)
    }
  }

  const ratesPayable = computeRatesPayable(data.rateableValue)

  return (
    <div className="max-w-3xl mx-auto">
      <StepCard number={1} title="Disposal Type">
        <div className="grid gap-2 sm:grid-cols-3">
          {DISPOSAL_OPTIONS.map(opt => {
            const active = data.disposalType === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => set('disposalType', opt.key)}
                className={`text-left rounded-md border px-3 py-3 transition-colors ${
                  active ? 'border-my-red bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? 'text-my-red' : 'text-my-black'}`}>{opt.title}</span>
                <span className="block text-xs text-gray-500">{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </StepCard>

      <StepCard number={2} title="Property">
        <TextField
          label="Full property address"
          value={data.address}
          onChange={v => set('address', v)}
          placeholder="Northside Business Centre, Wellington Street, Birmingham, B18 4NR"
        />
        <TextField
          label="Subtitle (optional)"
          value={data.subtitle}
          onChange={v => set('subtitle', v)}
          placeholder="Modern Industrial Units"
          hint="Shown under the FOR SALE / TO LET heading."
        />
      </StepCard>

      <StepCard number={3} title="Accommodation">
        <label className="flex-1 flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 font-semibold rounded-md px-4 py-3 cursor-pointer text-sm mb-2">
          <Upload size={18} />
          {data.floorPlanFile ? data.floorPlanFile.name : 'Attach floor plan, report or RV notice'}
          <input
            type="file"
            accept="image/*,.pdf,.xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={e => onFilesChosen(e.target.files)}
          />
        </label>
        <p className="text-xs text-gray-400 mb-3">
          Attach as many as you have at once — a floor plan, a full report, a Rateable Value/business rates notice — any mix of
          image, PDF or spreadsheet. Areas and Rateable Value below are read automatically from all of them, and their text is
          combined into Property Notes below, which drives the AI Property Description in Step 4. Image attachments are also
          embedded into the back-page gallery.
        </p>
        {ocrRunning && (
          <p className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <Loader2 size={14} className="animate-spin" /> Reading the attachments…
          </p>
        )}
        {ocrError && <p className="text-xs text-amber-700 mb-3">{ocrError}</p>}

        <div className="grid sm:grid-cols-2 gap-x-4 mb-4">
          <TextField label="Ground floor (sq ft)" value={data.groundFloorSqFt} onChange={v => set('groundFloorSqFt', v)} />
          <TextField label="Ground floor (sq m)" value={data.groundFloorSqM} onChange={v => set('groundFloorSqM', v)} />
          <TextField label="First floor (sq ft)" value={data.firstFloorSqFt} onChange={v => set('firstFloorSqFt', v)} />
          <TextField label="First floor (sq m)" value={data.firstFloorSqM} onChange={v => set('firstFloorSqM', v)} />
          <TextField label="Second floor (sq ft)" value={data.secondFloorSqFt} onChange={v => set('secondFloorSqFt', v)} />
          <TextField label="Second floor (sq m)" value={data.secondFloorSqM} onChange={v => set('secondFloorSqM', v)} />
          <TextField label="Other (sq ft)" value={data.otherFloorSqFt} onChange={v => set('otherFloorSqFt', v)} />
          <TextField label="Other (sq m)" value={data.otherFloorSqM} onChange={v => set('otherFloorSqM', v)} />
          <TextField label="Total (sq ft)" value={data.totalSqFt} onChange={v => set('totalSqFt', v)} />
          <TextField label="Total (sq m)" value={data.totalSqM} onChange={v => set('totalSqM', v)} />
        </div>

        <TextAreaField
          label="Property Notes"
          value={data.floorPlanNotes}
          onChange={v => set('floorPlanNotes', v)}
          rows={6}
          hint="Text read off the attachments above — edit or add to it freely. This is what the AI Property Description in Step 4 is written from, so anything worth describing (construction, fixtures, condition) should be in here."
        />
      </StepCard>

      <StepCard number={4} title="Location & Property Descriptions">
        <button
          type="button"
          onClick={handleGenerateDescriptions}
          disabled={generating}
          className="flex items-center gap-2 bg-my-black hover:bg-black text-white text-sm font-semibold rounded-md px-4 py-2 mb-4 disabled:opacity-50"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {generating ? 'Generating…' : 'Generate with AI'}
        </button>
        {aiError && <p className="text-sm text-red-600 mb-3">{aiError}</p>}
        <TextAreaField label="Location Description" value={data.locationDescription} onChange={v => set('locationDescription', v)} rows={4} />
        <TextAreaField label="Property Description" value={data.propertyDescription} onChange={v => set('propertyDescription', v)} rows={4} />
      </StepCard>

      <StepCard number={5} title="Bullet Points">
        <button
          type="button"
          onClick={suggestBullets}
          className="flex items-center gap-2 bg-my-black hover:bg-black text-white text-sm font-semibold rounded-md px-4 py-2 mb-4"
        >
          <Sparkles size={16} />
          Suggest bullet points
        </button>
        {data.bullets.map((b, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={b}
              onChange={e => setBullet(i, e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-my-red/40 focus:border-my-red"
              placeholder="SELF-CONTAINED"
            />
            <button type="button" onClick={() => removeBullet(i)} className="text-gray-400 hover:text-my-red" aria-label="Remove">
              <X size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addBullet} className="text-sm text-my-red hover:text-my-red-dark font-medium mt-1">
          + Add bullet point
        </button>
      </StepCard>

      <StepCard number={6} title="Tenure & Business Rates">
        {data.disposalType === 'freehold' && (
          <TextField label="Quoting price (£)" value={data.quotingPrice} onChange={v => set('quotingPrice', v)} placeholder="300,000" />
        )}
        {data.disposalType === 'leasehold' && (
          <TextField label="Quoting rent (£ p.a.)" value={data.quotingRent} onChange={v => set('quotingRent', v)} placeholder="30,000" />
        )}
        {data.disposalType === 'lease_assignment' && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <TextField label="Lease term (years)" value={data.leaseTermYears} onChange={v => set('leaseTermYears', v)} placeholder="10" />
            <TextField label="Lease start date" value={data.leaseStartDate} onChange={v => set('leaseStartDate', v)} placeholder="1st January 2024" />
            <TextField label="Passing rent (£ p.a.)" value={data.quotingRent} onChange={v => set('quotingRent', v)} placeholder="25,000" />
            <TextField label="Premium sought (£)" value={data.premium} onChange={v => set('premium', v)} placeholder="20,000" />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-x-4 mt-2">
          <TextField label="Rating list year" value={data.ratingYear} onChange={v => set('ratingYear', v)} />
          <TextField
            label="Rateable Value (£)"
            value={data.rateableValue}
            onChange={v => set('rateableValue', v)}
            placeholder="13,500"
            hint="Auto-filled if the attached report mentions it — check it's right, or enter it manually."
          />
        </div>
        {ratesPayable !== null && (
          <p className="text-sm text-gray-600 mt-1">Rates Payable: {formatCurrency(ratesPayable)} p.a. (RV × 0.432)</p>
        )}
      </StepCard>

      <StepCard number={7} title="Photos">
        <label className="flex-1 flex items-center justify-center gap-2 bg-my-red hover:bg-my-red-dark text-white font-semibold rounded-md px-4 py-3 cursor-pointer text-sm mb-2">
          <ImageIcon size={18} />
          {data.mainImage ? 'Change main photo' : 'Choose main photo'}
          <input type="file" accept="image/*" className="hidden" onChange={e => set('mainImage', e.target.files?.[0] ?? null)} />
        </label>
        <p className="text-xs text-gray-400 mb-3">The main photo — sent first — fills the cover, edge to edge under the heading.</p>

        <label className="flex-1 flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 font-semibold rounded-md px-4 py-3 cursor-pointer text-sm mb-2">
          <Upload size={18} />
          Add more photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files ?? [])
              if (files.length) set('galleryImages', [...data.galleryImages, ...files])
            }}
          />
        </label>
        <p className="text-xs text-gray-400 mb-3">
          These run down the right-hand column alongside the text — stacked, bordered, evenly spaced.
        </p>
        {data.galleryImages.length > 0 && (
          <ul className="text-sm text-gray-600 mb-3 list-disc pl-5">
            {data.galleryImages.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span>{f.name}</span>
                <button
                  type="button"
                  onClick={() => set('galleryImages', data.galleryImages.filter((_, idx) => idx !== i))}
                  className="text-gray-400 hover:text-my-red"
                  aria-label="Remove"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </StepCard>

      <div className="mt-2 mb-10">
        <button
          type="button"
          onClick={handleDownload}
          disabled={building}
          className="w-full flex items-center justify-center gap-2 bg-my-red hover:bg-my-red-dark text-white font-semibold rounded-md px-4 py-4 shadow-lg disabled:opacity-50"
        >
          {building ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
          {building ? 'Building brochure…' : 'Download brochure (.docx)'}
        </button>
      </div>
    </div>
  )
}

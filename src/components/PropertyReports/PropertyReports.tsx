import { useState } from 'react'
import { Camera, Upload, Sparkles, FileDown, Loader2 } from 'lucide-react'
import StepCard from './StepCard'
import { TextField, TextAreaField } from './fields'
import { BLANK_REPORT, type ReportData, type DisposalType, type FormLength } from './types'
import { generateDescriptions } from '../../lib/aiDescriptions'
import { generateReportDocx, downloadDocx, openInWordDesktop } from '../../lib/docxGenerator'
import { ocrFloorPlan } from '../../lib/ocr'
import { extractTotalSqFt } from '../../lib/areaExtract'
import { isSpreadsheetFile, extractFloorSchedule } from '../../lib/spreadsheet'

const REPORT_TYPE_OPTIONS: {
  key: string
  title: string
  desc: string
  disposalType: DisposalType
  formLength: FormLength
}[] = [
  {
    key: 'short_freehold',
    title: 'Short Form – Freehold',
    desc: 'Condensed terms letter for a freehold sale',
    disposalType: 'freehold',
    formLength: 'short',
  },
  {
    key: 'short_leasehold',
    title: 'Short Form – Leasehold',
    desc: 'Condensed terms letter for a leasehold letting',
    disposalType: 'leasehold',
    formLength: 'short',
  },
  {
    key: 'long_freehold',
    title: 'Long Form – Freehold',
    desc: 'Full marketing appraisal report for a freehold sale',
    disposalType: 'freehold',
    formLength: 'long',
  },
  {
    key: 'long_leasehold',
    title: 'Long Form – Leasehold',
    desc: 'Full marketing appraisal report for a leasehold letting',
    disposalType: 'leasehold',
    formLength: 'long',
  },
]

export default function PropertyReports() {
  const [data, setData] = useState<ReportData>(BLANK_REPORT)
  const [reportTypeKey, setReportTypeKey] = useState('long_freehold')
  const [generating, setGenerating] = useState(false)
  const [aiError, setAiError] = useState('')
  const [building, setBuilding] = useState(false)
  const [openError, setOpenError] = useState('')
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrError, setOcrError] = useState('')

  const isLong = data.formLength === 'long'

  function set<K extends keyof ReportData>(key: K, value: ReportData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function pickReportType(key: string) {
    const opt = REPORT_TYPE_OPTIONS.find(o => o.key === key)!
    setReportTypeKey(key)
    setData(prev => ({
      ...prev,
      disposalType: opt.disposalType,
      formLength: opt.formLength,
      // Type-specific commercial terms reset to defaults so numbers typed
      // for the previous type (e.g. a sale price while on Freehold) don't
      // linger, unused, after switching to a Leasehold/Short-form type.
      quotingPrice: BLANK_REPORT.quotingPrice,
      targetPrice: BLANK_REPORT.targetPrice,
      quotingRent: BLANK_REPORT.quotingRent,
      targetRent: BLANK_REPORT.targetRent,
      saleFeePercent: BLANK_REPORT.saleFeePercent,
      lettingFeeFirstYearPercent: BLANK_REPORT.lettingFeeFirstYearPercent,
      managedService: BLANK_REPORT.managedService,
      managedServiceLettingFeePercent: BLANK_REPORT.managedServiceLettingFeePercent,
      managementFeePercent: BLANK_REPORT.managementFeePercent,
      groundFloorSqFt: BLANK_REPORT.groundFloorSqFt,
      firstFloorSqFt: BLANK_REPORT.firstFloorSqFt,
      otherFloorSqFt: BLANK_REPORT.otherFloorSqFt,
      totalSqFt: BLANK_REPORT.totalSqFt,
      tenureNotes: BLANK_REPORT.tenureNotes,
    }))
  }

  async function runGenerate(address: string, notes: string) {
    if (!address.trim()) {
      setAiError('Enter the property address first (Step 2).')
      return
    }
    setAiError('')
    setGenerating(true)
    try {
      const { location, property } = await generateDescriptions(address, notes)
      setData(prev => ({ ...prev, locationDescription: location, propertyDescription: property }))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate descriptions')
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerateDescriptions() {
    return runGenerate(data.address, data.floorPlanNotes)
  }

  async function onFilesChosen(files: FileList | null) {
    if (!files || files.length === 0) return
    const fileArr = Array.from(files)
    const names = fileArr.map(f => f.name)
    setData(prev => ({ ...prev, attachmentNames: [...prev.attachmentNames, ...names] }))

    const imageFiles = fileArr.filter(f => f.type.startsWith('image/'))
    const spreadsheetFiles = fileArr.filter(isSpreadsheetFile)
    if (imageFiles.length === 0 && spreadsheetFiles.length === 0) return

    setOcrError('')
    setOcrRunning(true)
    try {
      const [ocrTexts, schedules] = await Promise.all([
        Promise.all(imageFiles.map(f => ocrFloorPlan(f))),
        Promise.all(spreadsheetFiles.map(f => extractFloorSchedule(f))),
      ])

      const ocrText = ocrTexts.filter(t => t.trim()).join('\n')
      const scheduleNotes = schedules.map(s => s.notes).filter(t => t.trim()).join('\n')
      const extracted = [ocrText, scheduleNotes].filter(Boolean).join('\n')
      if (!extracted) return

      const combinedNotes = data.floorPlanNotes ? `${data.floorPlanNotes}\n${extracted}` : extracted

      // A spreadsheet's own Grand Total row is exact; only fall back to
      // pattern-matching sq ft/sq m mentions in OCR'd photo text.
      const scheduleTotal = schedules.map(s => s.totalSqFt).find(t => t !== null) ?? null
      const sqFt = scheduleTotal ?? extractTotalSqFt(ocrText)

      setData(prev => ({
        ...prev,
        floorPlanNotes: combinedNotes,
        totalSqFt: sqFt !== null ? String(sqFt) : prev.totalSqFt,
      }))

      // Immediately draft the descriptions from what was just read off the
      // floor plan, rather than waiting for a separate manual click.
      await runGenerate(data.address, combinedNotes)
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Could not read the attachment — add notes manually below.')
    } finally {
      setOcrRunning(false)
    }
  }

  async function handleOpenInWord() {
    setBuilding(true)
    setOpenError('')
    try {
      const { blob, filename } = await generateReportDocx(data)
      try {
        await openInWordDesktop(blob, filename)
      } catch (err) {
        setOpenError(
          (err instanceof Error ? err.message : 'Could not launch Word directly') +
            ' — downloading the file instead. Double-click it to open in Word.'
        )
        downloadDocx(blob, filename)
      }
    } finally {
      setBuilding(false)
    }
  }

  async function handleDownloadInstead() {
    setBuilding(true)
    try {
      const { blob, filename } = await generateReportDocx(data)
      downloadDocx(blob, filename)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepCard number={1} title="Report Type">
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_TYPE_OPTIONS.map(opt => {
            const active = reportTypeKey === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => pickReportType(opt.key)}
                className={`text-left rounded-md border px-3 py-3 transition-colors ${
                  active ? 'border-my-red bg-red-50' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <span className={`block text-sm font-semibold ${active ? 'text-my-red' : 'text-my-black'}`}>
                  {opt.title}
                </span>
                <span className="block text-xs text-gray-500">{opt.desc}</span>
              </button>
            )
          })}
        </div>
      </StepCard>

      <StepCard number={2} title="Property & Client">
        <TextField
          label="Client full name"
          value={data.clientName}
          onChange={v => set('clientName', v)}
          placeholder="Graham Clough"
          hint="Used in the recipient address block at the top of the letter."
        />
        <TextField
          label="Client address"
          value={data.clientAddress}
          onChange={v => set('clientAddress', v)}
          placeholder="Saya GB Limited, Ground Floor, 182 Uxbridge Road, London, England, W12 7JP"
          hint="Where the letter is addressed to — often different from the property address. Leave blank to use the property address instead."
        />
        <TextField
          label="Client salutation"
          value={data.clientSalutation}
          onChange={v => set('clientSalutation', v)}
          placeholder="Dear James / Dear Mr Lacey"
        />
        <TextField
          label="Full property address"
          value={data.address}
          onChange={v => set('address', v)}
          placeholder="11-12 Tenby Street, Jewellery Quarter, Birmingham, B1 3AJ"
          hint="Used for the Re: line and to draft the Location Description."
        />
      </StepCard>

      <StepCard number={3} title="Attach Files">
        <div className="flex flex-col sm:flex-row gap-3 mb-2">
          <label className="flex-1 flex items-center justify-center gap-2 bg-my-red hover:bg-my-red-dark text-white font-semibold rounded-md px-4 py-3 cursor-pointer text-sm">
            <Camera size={18} />
            Take a photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={e => onFilesChosen(e.target.files)}
            />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 border border-gray-300 hover:border-gray-400 font-semibold rounded-md px-4 py-3 cursor-pointer text-sm">
            <Upload size={18} />
            Choose a file
            <input type="file" multiple className="hidden" onChange={e => onFilesChosen(e.target.files)} />
          </label>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Floor plans, site photos, anything useful — on a phone this opens the camera.
        </p>
        {ocrRunning && (
          <p className="flex items-center gap-2 text-xs text-gray-500 mb-3">
            <Loader2 size={14} className="animate-spin" /> Reading text off the photo…
          </p>
        )}
        {ocrError && <p className="text-xs text-amber-700 mb-3">{ocrError}</p>}
        {data.attachmentNames.length > 0 && (
          <ul className="text-sm text-gray-600 mb-3 list-disc pl-5">
            {data.attachmentNames.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        )}
        <TextAreaField
          label="Notes from the floor plan / site visit"
          value={data.floorPlanNotes}
          onChange={v => set('floorPlanNotes', v)}
          placeholder="e.g. solid floor with tiled covering, part plastered and painted walls, suspended ceiling with LED lights, stainless steel kitchen, WC facilities, electric metal roller shutter externally..."
          rows={4}
          hint="These notes feed directly into the Property Description below."
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
        <TextAreaField
          label="Location Description"
          value={data.locationDescription}
          onChange={v => set('locationDescription', v)}
          rows={5}
        />
        <TextAreaField
          label="Property Description"
          value={data.propertyDescription}
          onChange={v => set('propertyDescription', v)}
          rows={5}
        />
      </StepCard>

      <StepCard number={5} title="Commercial Terms">
        {data.disposalType === 'freehold' ? (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <TextField label="Quoting price (£)" value={data.quotingPrice} onChange={v => set('quotingPrice', v)} placeholder="225,000" />
            <TextField label="Target price (£)" value={data.targetPrice} onChange={v => set('targetPrice', v)} placeholder="200,000" />
            <TextField label="Sale fee (%)" value={data.saleFeePercent} onChange={v => set('saleFeePercent', v)} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <TextField label="Quoting rent (£ p.a.)" value={data.quotingRent} onChange={v => set('quotingRent', v)} placeholder="23,000" />
            <TextField label="Target rent (£ p.a.)" value={data.targetRent} onChange={v => set('targetRent', v)} placeholder="21,000" />
            <TextField label="First-year letting fee (%)" value={data.lettingFeeFirstYearPercent} onChange={v => set('lettingFeeFirstYearPercent', v)} />
            <label className="flex items-center gap-2 mt-6 text-sm">
              <input type="checkbox" checked={data.managedService} onChange={e => set('managedService', e.target.checked)} />
              Offer managed service
            </label>
            {data.managedService && (
              <>
                <TextField label="Managed letting fee (%)" value={data.managedServiceLettingFeePercent} onChange={v => set('managedServiceLettingFeePercent', v)} />
                <TextField label="Annual management fee (%)" value={data.managementFeePercent} onChange={v => set('managementFeePercent', v)} />
              </>
            )}
          </div>
        )}

        {isLong && (
          <>
            <div className="grid sm:grid-cols-2 gap-x-4 mt-2">
              <TextField label="Ground floor (sq ft)" value={data.groundFloorSqFt} onChange={v => set('groundFloorSqFt', v)} />
              <TextField label="First floor (sq ft)" value={data.firstFloorSqFt} onChange={v => set('firstFloorSqFt', v)} />
              <TextField label="Other / total (sq ft)" value={data.totalSqFt} onChange={v => set('totalSqFt', v)} />
            </div>
            <TextField label="Services connected" value={data.servicesNotes} onChange={v => set('servicesNotes', v)} />
            <TextAreaField label="Condition notes" value={data.conditionNotes} onChange={v => set('conditionNotes', v)} rows={2} />
            <TextAreaField
              label="Tenure notes (optional — leave blank for the standard wording)"
              value={data.tenureNotes}
              onChange={v => set('tenureNotes', v)}
              rows={2}
            />
          </>
        )}
      </StepCard>

      <div className="mt-2 mb-10">
        {openError && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-2">{openError}</p>}
        <button
          type="button"
          onClick={handleOpenInWord}
          disabled={building}
          className="w-full flex items-center justify-center gap-2 bg-my-red hover:bg-my-red-dark text-white font-semibold rounded-md px-4 py-4 shadow-lg disabled:opacity-50"
        >
          {building ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
          {building ? 'Building document…' : 'Open in Word'}
        </button>
        <button
          type="button"
          onClick={handleDownloadInstead}
          disabled={building}
          className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-2 disabled:opacity-50"
        >
          Or just download the .docx file
        </button>
      </div>
    </div>
  )
}

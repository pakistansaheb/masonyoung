import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { BrochureData } from '../components/PropertyBrochures/types'
import { computeRatesPayable, formatCurrency } from './brochureBoilerplate'
import {
  replaceSectionBody,
  replaceParagraphAt,
  replaceParagraphBefore,
  replaceParagraphTextKeepPPr,
  rebuildAccommodationTable,
  buildPictureRun,
  insertParagraphAfter,
  nextRelationshipId,
} from './brochureTemplateEngine'

import templateFhUrl from '../assets/brochureTemplates/FH.docx?url'
import templateLhUrl from '../assets/brochureTemplates/LH.docx?url'
import templateLfsUrl from '../assets/brochureTemplates/LFS.docx?url'

const PT_TO_EMU = 12700
const CM_TO_EMU = 360000

function withCommas(value: string): string {
  const n = Number(value.replace(/,/g, ''))
  return Number.isFinite(n) ? n.toLocaleString('en-GB') : value
}

const SQFT_PER_SQM = 10.7639

// Reports usually only quote one of sq ft / sq m — the other is derived
// automatically so the ACCOMMODATION table never shows a blank/zero figure
// when the source data only gave one of the two.
function deriveSqM(sqFt: string, sqM: string): string {
  if (sqM.trim()) return sqM
  const n = Number(sqFt.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? String(Math.round(n / SQFT_PER_SQM)) : ''
}

function deriveSqFt(sqFt: string, sqM: string): string {
  if (sqFt.trim()) return sqFt
  const n = Number(sqM.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * SQFT_PER_SQM)) : ''
}

async function fileDims(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file)
  return { width: bitmap.width, height: bitmap.height }
}

function extFor(file: File): 'jpeg' | 'png' {
  return file.type.includes('png') ? 'png' : 'jpeg'
}

const templateUrls: Record<BrochureData['disposalType'], string> = {
  freehold: templateFhUrl,
  leasehold: templateLhUrl,
  lease_assignment: templateLfsUrl,
}

function floorRows(d: BrochureData): { label: string; sqFt: string; sqM: string }[] {
  const rows: { label: string; sqFt: string; sqM: string }[] = []
  const push = (label: string, sqFt: string, sqM: string) => {
    if (!sqFt.trim() && !sqM.trim()) return
    rows.push({ label, sqFt: withCommas(deriveSqFt(sqFt, sqM)), sqM: withCommas(deriveSqM(sqFt, sqM)) })
  }
  push('Ground Floor', d.groundFloorSqFt, d.groundFloorSqM)
  push('First Floor', d.firstFloorSqFt, d.firstFloorSqM)
  push('Second Floor', d.secondFloorSqFt, d.secondFloorSqM)
  push('Other', d.otherFloorSqFt, d.otherFloorSqM)
  return rows
}

// The TOTAL is whatever was explicitly given/extracted — but when a report
// only breaks the area down floor-by-floor with no separate "total" figure,
// summing the floors automatically beats showing a literal "0".
function deriveTotalSqFt(d: BrochureData): string {
  if (d.totalSqFt.trim()) return d.totalSqFt
  const pairs: [string, string][] = [
    [d.groundFloorSqFt, d.groundFloorSqM],
    [d.firstFloorSqFt, d.firstFloorSqM],
    [d.secondFloorSqFt, d.secondFloorSqM],
    [d.otherFloorSqFt, d.otherFloorSqM],
  ]
  const sum = pairs
    .map(([sqFt, sqM]) => Number(deriveSqFt(sqFt, sqM) || '0'))
    .filter(n => Number.isFinite(n) && n > 0)
    .reduce((a, b) => a + b, 0)
  return sum > 0 ? String(sum) : ''
}

// Heading markers deliberately drop the trailing `<` — the real templates
// are inconsistent about trailing whitespace/punctuation right before the
// closing tag on several headings (confirmed: LH's "BUILDING INSURANCE"
// has trailing spaces in-run, LFS's "TENURE/PRICE" has a trailing period),
// so requiring an exact `>HEADING<` match silently fails on those. The
// bare "> + text" prefix is stable everywhere.
//
// Each section here only gets edited when its own figures were actually
// given — with nothing to put in a section, its heading and the
// template's own example text under it are left exactly as shipped.
function tenureAndRatesXml(xml: string, d: BrochureData): string {
  if (d.disposalType === 'freehold') {
    if (d.quotingPrice.trim()) {
      xml = replaceSectionBody(xml, '>TENURE/PRICE', '>BUSINESS RATES', `The freehold interest is available at a quoting price of £${d.quotingPrice} subject to contract.`)
    }
  } else if (d.disposalType === 'leasehold') {
    if (d.quotingRent.trim()) {
      xml = replaceSectionBody(
        xml,
        '>TENURE/RENT',
        '>BUSINESS RATES',
        `The property is available on a leasehold basis at a quoting rent of £${d.quotingRent} per annum exclusive, subject to contract. Terms to be agreed.`
      )
    }
  } else {
    // LFS has TWO separate headed sections here (LEASE DETAILS, then its
    // own TENURE/PRICE) — each depends on its own fields, so each is only
    // edited when it has something to say.
    if (d.leaseTermYears.trim() || d.leaseStartDate.trim() || d.quotingRent.trim()) {
      xml = replaceSectionBody(
        xml,
        '>LEASE DETAILS',
        '>TENURE/PRICE',
        `The property is let on a ${d.leaseTermYears || '[XX]'} year lease with effect from ${d.leaseStartDate || '[DATE]'} at a passing rent of £${d.quotingRent || '[RENT]'} per annum.`
      )
    }
    if (d.premium.trim()) {
      xml = replaceSectionBody(xml, '>TENURE/PRICE', '>BUSINESS RATES', `A premium of £${d.premium} is sought in respect of the fixtures and fittings. Stock at value. Further details are available upon request.`)
    }
  }

  if (d.rateableValue.trim()) {
    const nextAfterRates = d.disposalType === 'leasehold' ? '>BUILDING INSURANCE' : '>MONEY LAUNDERING'
    const rates = computeRatesPayable(d.rateableValue)
    const ratesText = rates !== null ? formatCurrency(rates) : '[RATES]'
    xml = replaceSectionBody(
      xml,
      '>BUSINESS RATES',
      nextAfterRates,
      `The property is currently listed within the ${d.ratingYear} rating listing as having a rateable value of £${d.rateableValue}. Rates payable will be in the region of ${ratesText} per annum. Interested parties are advised to make their own enquiries to Birmingham City Council on 0121 303 5511.`
    )
  }
  return xml
}

export async function generateBrochureDocx(d: BrochureData): Promise<{ blob: Blob; filename: string }> {
  const templateUrl = templateUrls[d.disposalType]
  const templateBytes = await (await fetch(templateUrl)).arrayBuffer()
  const zip = await JSZip.loadAsync(templateBytes)

  const docFile = zip.file('word/document.xml')
  if (!docFile) throw new Error('Template is missing word/document.xml')
  let xml = await docFile.async('string')

  // --- Photos setup (rels needed before the hero photo is anchored below) ---
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (!relsFile) throw new Error('Template is missing word/_rels/document.xml.rels')
  let relsXml = await relsFile.async('string')
  let nextRid = nextRelationshipId(relsXml)
  let docPrId = 900
  let mediaIndex = 0

  async function embedPhoto(file: File): Promise<{ rId: string; widthPx: number; heightPx: number }> {
    const dims = await fileDims(file)
    const ext = extFor(file)
    const mediaName = `image-brochure-${mediaIndex++}.${ext}`
    zip.file(`word/media/${mediaName}`, await file.arrayBuffer())
    const rId = `rId${nextRid++}`
    const closeTag = '</Relationships>'
    relsXml =
      relsXml.slice(0, relsXml.lastIndexOf(closeTag)) +
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/>` +
      relsXml.slice(relsXml.lastIndexOf(closeTag))
    return { rId, widthPx: dims.width, heightPx: dims.height }
  }

  // --- Cover: subtitle, address, sq ft line, 4 bullet points. Anything
  // not given is simply left untouched — the template's own placeholder
  // text ("TITLE", "BULLET POINT", "SQ FT (SQ M)") stays visible rather
  // than being removed or replaced with brackets. Only fields with real
  // data get edited. ---
  const subtitle = d.subtitle.trim()
  const subtitleMarker = d.disposalType === 'freehold' ? '>TITLE<' : '>DESCRIPTION<'

  // Main photo: a hero shot filling the blank gap on the cover, between the
  // header and the address. Width matches the REAL filled exemplars exactly
  // (measured directly from Northside Business Centre's own VML shape:
  // margin-left 77.25pt, width 444pt — inset and centered on the 595.3pt
  // page, not edge-to-edge). Anchored on the logo image's own paragraph,
  // which sits in the main document flow — the subtitle marker itself lives
  // INSIDE the header's floating VML text box, whose coordinate space is
  // local to that box, not the page, so anchoring there mispositions the
  // photo. The header text box is a fixed height in every real exemplar
  // (~175-178pt, regardless of whether the subtitle wraps to one or two
  // lines), so a fixed offset from the logo's paragraph holds up either way.
  if (d.mainImage) {
    const { rId, widthPx, heightPx } = await embedPhoto(d.mainImage)
    const heroWidthPt = 444
    const heroWidthEmu = heroWidthPt * PT_TO_EMU
    const heroHeightEmu = Math.round((heroWidthEmu * heightPx) / widthPx)
    const heroXPt = (595.3 - heroWidthPt) / 2
    const run = buildPictureRun({
      rId,
      docPrId: docPrId++,
      xEmu: Math.round(heroXPt * PT_TO_EMU),
      yEmu: 190 * PT_TO_EMU,
      widthEmu: heroWidthEmu,
      heightEmu: heroHeightEmu,
      border: true,
    })
    xml = insertParagraphAfter(xml, 'Mason Young Logo.png', run)
  }

  if (subtitle) {
    xml = replaceParagraphAt(xml, subtitleMarker, subtitle.toUpperCase(), { bold: true, size: 52 })
  }

  const totalSqFt = deriveTotalSqFt(d)
  const totalSqM = deriveSqM(totalSqFt, d.totalSqM)
  const sqFtLine = totalSqFt ? `${withCommas(totalSqFt)} SQ FT${totalSqM ? ` (${withCommas(totalSqM)} SQ M)` : ''}` : ''
  // LFS's placeholder text is fragmented across runs by Word's own
  // spell-check revisions ("S" + "Q FT (SQ M)" as two separate runs) — this
  // marker targets the second, unfragmented run rather than the whole phrase.
  const sqFtMarker = d.disposalType === 'freehold' ? '>SQ FT (<' : d.disposalType === 'leasehold' ? '>SQ FT (SQ M)<' : '>Q FT (SQ M)<'
  // Address first: it's anchored on the sq-ft marker's position, so it has
  // to run before that marker's own paragraph is replaced.
  xml = replaceParagraphBefore(xml, sqFtMarker, d.address.toUpperCase(), { bold: true, size: 52 })
  if (sqFtLine) {
    xml = replaceParagraphAt(xml, sqFtMarker, sqFtLine, { bold: true, color: 'FF0000', size: 48 })
  }

  const bullets = d.bullets.filter(b => b.trim())
  // No trailing `<` — LH's placeholder runs have inconsistent trailing
  // whitespace before the closing tag ("BULLET POINTS<" on 3 of them,
  // "BULLET POINTS <" on the 4th), and "BULLET POINT" is a safe substring
  // of both the singular (FH) and plural (LH/LFS) placeholder text.
  const bulletMarker = '>BULLET POINT'
  for (let i = 0; i < bullets.length && i < 4; i++) {
    // Always occurrence 0: each replacement consumes one marker instance,
    // so the next bullet to fill is always whatever's left at position 0.
    xml = replaceParagraphTextKeepPPr(xml, bulletMarker, bullets[i].toUpperCase(), 0)
  }

  // --- Body sections: a section with no real content behind it is left
  // completely untouched — the template's own example text stays exactly
  // as shipped. PLANNING/SERVICES/EPC/MONEY LAUNDERING/VAT/LEGAL COSTS/
  // VIEWING/CONTACT DETAILS/the disclaimer are always left alone too. ---
  if (d.locationDescription.trim()) {
    xml = replaceSectionBody(xml, '>LOCATION<', '>DESCRIPTION<', d.locationDescription)
  }
  if (d.propertyDescription.trim()) {
    xml = replaceSectionBody(xml, '>DESCRIPTION<', '>ACCOMMODATION<', d.propertyDescription)
  }
  const floors = floorRows(d)
  if (floors.length || totalSqFt) {
    xml = rebuildAccommodationTable(xml, floors, { sqFt: withCommas(totalSqFt), sqM: withCommas(totalSqM) })
  }
  xml = tenureAndRatesXml(xml, d)

  // --- Remaining photos ---

  // Gallery photos: run down the right-hand column on page 2, height fixed
  // at 7.55cm, black border, 10pt apart — same spec as the real templates'
  // own photo columns (Vittoria Street, Northside, etc.).
  const galleryFiles = [...d.galleryImages, ...(d.floorPlanFile && d.floorPlanFile.type.startsWith('image/') ? [d.floorPlanFile] : [])].slice(0, 2)
  const heightEmu = 7.55 * CM_TO_EMU
  const xEmu = 300 * PT_TO_EMU
  let yEmu = 20 * PT_TO_EMU
  const gapEmu = 10 * PT_TO_EMU
  let galleryRuns = ''
  for (const file of galleryFiles) {
    const { rId, widthPx, heightPx } = await embedPhoto(file)
    const widthEmu = Math.round((heightEmu * widthPx) / heightPx)
    galleryRuns += buildPictureRun({ rId, docPrId: docPrId++, xEmu, yEmu, widthEmu, heightEmu, border: true })
    yEmu += heightEmu + gapEmu
  }
  if (galleryRuns) {
    xml = insertParagraphAfter(xml, '>ACCOMMODATION<', galleryRuns)
  }

  zip.file('word/_rels/document.xml.rels', relsXml)
  zip.file('word/document.xml', xml)

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `${d.address || 'Property'} - Brochure.docx`.replace(/[\\/:*?"<>|]/g, '')
  return { blob, filename }
}

export function downloadBrochureDocx(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}

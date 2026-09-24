import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  FrameAnchorType,
  PageBreak,
  type IParagraphOptions,
} from 'docx'
import { saveAs } from 'file-saver'
import type { BrochureData } from '../components/PropertyBrochures/types'
import { BROCHURE_HEADING, BROCHURE_RATE_COLUMN_LABEL, BROCHURE_DISCLAIMER, computeRatesPayable } from './brochureBoilerplate'
import { BROCHURE_FRONT_LOGO_BASE64 } from '../assets/brochureFrontLogoBase64'
import { BROCHURE_BACK_LOGO_BASE64 } from '../assets/brochureBackLogoBase64'

const FONT = 'Century Gothic'

// A4, zero margins — matches every real Mason Young brochure exactly
// (confirmed from the raw XML: <w:pgMar top="0" right="0" bottom="0" left="0".../>).
// Everything on the page is absolutely positioned.
const PAGE_WIDTH_TWIPS = 11906
const PAGE_HEIGHT_TWIPS = 16838
const PAGE_WIDTH_PT = 595.3
const PT_TO_TWIP = 20
const PT_TO_EMU = 12700
const CM_TO_PT = 28.3465

function base64ToBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function fileToImage(file: File): Promise<{ bytes: Uint8Array; width: number; height: number; type: 'png' | 'jpg' }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const bitmap = await createImageBitmap(file)
  const type = file.type.includes('png') ? 'png' : 'jpg'
  return { bytes, width: bitmap.width, height: bitmap.height, type }
}

// A red horizontal rule spanning the full page width — a borderless
// paragraph positioned by an absolute frame, with just a bottom border.
// This is how every rule line in the real templates renders (their
// AutoShape lines convert to the same visual result).
function redRule(yPt: number): Paragraph {
  return new Paragraph({
    frame: {
      type: 'absolute',
      position: { x: 0, y: Math.round(yPt * PT_TO_TWIP) },
      width: Math.round(PAGE_WIDTH_PT * PT_TO_TWIP),
      height: Math.round(4 * PT_TO_TWIP),
      anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    },
    border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: 'FF0000' } },
    children: [],
  })
}

// NOTE: `children` are raw Paragraph *constructor options*, not already-built
// Paragraph instances — spreading a built Paragraph instance doesn't recover
// its original options (it's a class wrapping internal XML nodes), which
// silently corrupts the document.
//
// Word's "frame chaining" (only the first paragraph of a block carries
// w:framePr, later paragraphs implicitly continue the same frame) is NOT
// reliably honoured by this LibreOffice rendering pipeline — testing showed
// later paragraphs either vanish or get clipped. Every paragraph gets its
// own explicit frame at its own Y band instead, which is fully reliable
// regardless of renderer.
function framedParagraph(opts: {
  x: number
  y: number
  width: number
  lineHeight: number
  children: IParagraphOptions[]
}): Paragraph[] {
  return opts.children.map((p, i) => {
    const frame = {
      type: 'absolute' as const,
      position: { x: Math.round(opts.x * PT_TO_TWIP), y: Math.round((opts.y + i * opts.lineHeight) * PT_TO_TWIP) },
      width: Math.round(opts.width * PT_TO_TWIP),
      height: Math.round(opts.lineHeight * PT_TO_TWIP),
      anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    }
    return new Paragraph({ ...p, frame })
  })
}

function floatingImageParagraph(opts: {
  bytes: Uint8Array
  type: 'png' | 'jpg'
  xPt: number
  yPt: number
  widthPt: number
  heightPt: number
  border?: boolean
}): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [
      new ImageRun({
        data: opts.bytes,
        type: opts.type,
        transformation: { width: opts.widthPt, height: opts.heightPt },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round(opts.xPt * PT_TO_EMU) },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round(opts.yPt * PT_TO_EMU) },
          allowOverlap: true,
          behindDocument: true,
          wrap: { type: TextWrappingType.NONE },
        },
        ...(opts.border ? { outline: { width: 12700, type: 'solidFill' as const, solidFillType: 'rgb' as const, value: '000000' } } : {}),
      }),
    ],
  })
}

export async function generateBrochureDocx(d: BrochureData): Promise<{ blob: Blob; filename: string }> {
  const heading = BROCHURE_HEADING[d.disposalType]
  const rateLabel = BROCHURE_RATE_COLUMN_LABEL[d.disposalType]
  const ratesPayable = computeRatesPayable(d.rateableValue)

  const logoBytes = base64ToBytes(BROCHURE_FRONT_LOGO_BASE64)
  const backLogoBytes = base64ToBytes(BROCHURE_BACK_LOGO_BASE64)

  const mainImg = d.mainImage ? await fileToImage(d.mainImage) : null
  const galleryImgs = await Promise.all(d.galleryImages.map(fileToImage))
  const floorPlanImg = d.floorPlanFile && d.floorPlanFile.type.startsWith('image/') ? await fileToImage(d.floorPlanFile) : null

  const children: (Paragraph | Table)[] = []

  // --- Logo, top-left, 207.8 x 156pt (real front-page logo size) ---
  children.push(floatingImageParagraph({ bytes: logoBytes, type: 'png', xPt: 7.5, yPt: 8.25, widthPt: 207.8, heightPt: 156 }))

  // --- Heading + subtitle, top-right (own frames — the heading's 100pt
  // font needs a much taller band than the subtitle's 26pt one) ---
  children.push(
    ...framedParagraph({
      x: 220,
      y: 25,
      width: 375,
      lineHeight: 130,
      children: [
        {
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: heading, font: FONT, bold: true, color: 'FF0000', size: 200 })],
        },
      ],
    })
  )
  if (d.subtitle.trim()) {
    children.push(
      ...framedParagraph({
        x: 220,
        y: 155,
        width: 375,
        lineHeight: 34,
        children: [
          {
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: d.subtitle.trim().toUpperCase(), font: FONT, bold: true, size: 52 })],
          },
        ],
      })
    )
  }

  let y = 196 // just below the logo/heading block
  children.push(redRule(y))
  y += 8

  // --- Hero image, freestyle: full bleed edge-to-edge between the rules ---
  let heroBottom = y
  if (mainImg) {
    const heroWidth = PAGE_WIDTH_PT
    let heroHeight = (heroWidth * mainImg.height) / mainImg.width
    if (heroHeight > 380) heroHeight = 380
    children.push(floatingImageParagraph({ bytes: mainImg.bytes, type: mainImg.type, xPt: 0, yPt: y, widthPt: heroWidth, heightPt: heroHeight }))
    heroBottom = y + heroHeight
  }
  children.push(redRule(heroBottom))
  y = heroBottom + 10

  // --- Address ---
  children.push(
    ...framedParagraph({
      x: 0,
      y,
      width: PAGE_WIDTH_PT,
      lineHeight: 70,
      children: [
        {
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: d.address.toUpperCase(), font: FONT, bold: true, size: 52 })],
        },
      ],
    })
  )
  y += 70

  // --- Sq ft line ---
  if (d.sqFtText.trim()) {
    children.push(
      ...framedParagraph({
        x: 0,
        y,
        width: PAGE_WIDTH_PT,
        lineHeight: 34,
        children: [
          {
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 0 },
            children: [new TextRun({ text: d.sqFtText.toUpperCase(), font: FONT, bold: true, color: 'FF0000', size: 48 })],
          },
        ],
      })
    )
    y += 34
  }

  // --- Bullets ---
  const bullets = d.bullets.filter(b => b.trim())
  if (bullets.length) {
    children.push(
      ...framedParagraph({
        x: 150,
        y: y + 10,
        width: PAGE_WIDTH_PT - 300,
        lineHeight: 24,
        children: bullets.map(b => ({
          spacing: { before: 0, after: 0, line: 276, lineRule: 'auto' as const },
          children: [
            new TextRun({ text: '■  ', font: FONT, bold: true, color: 'FF0000', size: 32 }),
            new TextRun({ text: b.toUpperCase(), font: FONT, bold: true, size: 32 }),
          ],
        })),
      })
    )
    y += 10 + bullets.length * 24
  }

  // --- Contact block (bottom-left) + agency address (bottom-right) ---
  const contactY = 743
  children.push(
    ...framedParagraph({
      x: 12,
      y: contactY,
      width: 260,
      lineHeight: 17,
      children: [
        {
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'T:  ', font: FONT, bold: true, size: 18 }),
            new TextRun({ text: '0121 285 3535', font: FONT, bold: true, color: 'FF0000', size: 18 }),
          ],
        },
        {
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'F:  ', font: FONT, bold: true, size: 18 }),
            new TextRun({ text: '0121 285 3536', font: FONT, bold: true, color: 'FF0000', size: 18 }),
          ],
        },
        {
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'W:  ', font: FONT, bold: true, size: 18 }),
            new TextRun({ text: 'masonyoung.co.uk', font: FONT, bold: true, color: 'FF0000', underline: {}, size: 18 }),
          ],
        },
        {
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'E:  ', font: FONT, bold: true, size: 18 }),
            new TextRun({ text: 'info@masonyoung.co.uk', font: FONT, bold: true, color: 'FF0000', underline: {}, size: 18 }),
          ],
        },
      ],
    })
  )
  const agencyAddressLines = ['6 Warstone Mews', 'Warstone Lane', 'Jewellery Quarter', 'Birmingham', 'B18 6JB']
  children.push(
    ...framedParagraph({
      x: PAGE_WIDTH_PT - 260,
      y: contactY,
      width: 248,
      lineHeight: 70,
      children: [
        {
          alignment: AlignmentType.RIGHT,
          spacing: { before: 0, after: 0, line: 240, lineRule: 'auto' as const },
          children: agencyAddressLines.flatMap((line, i) => [
            ...(i > 0 ? [new TextRun({ text: '', break: 1 })] : []),
            new TextRun({ text: line, font: FONT, bold: true, size: 18 }),
          ]),
        },
      ],
    })
  )

  // LOCATION heading + text, framed at a fixed position below the bullets.
  // (A normal-flow paragraph here rendered near the TOP of the page instead
  // — framed paragraphs don't advance the normal flow cursor by their
  // visual frame height, only their own single natural text line, so any
  // later plain paragraph ends up positioned as if the frames barely
  // existed. Framing it directly, now that the hero image's flow-height
  // contribution is fixed via behindDocument, positions it reliably.)
  children.push(
    new Paragraph({
      frame: {
        type: 'absolute',
        position: { x: Math.round(12 * PT_TO_TWIP), y: Math.round(818 * PT_TO_TWIP) },
        width: Math.round((PAGE_WIDTH_PT - 24) * PT_TO_TWIP),
        height: Math.round(16 * PT_TO_TWIP),
        anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
      },
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'LOCATION', font: FONT, bold: true, size: 16, underline: { type: 'thick', color: 'FF0000' } })],
    })
  )
  children.push(new Paragraph({ children: [new PageBreak()] }))

  // Location text continues at the top of page 2 — the contact block on
  // page 1 already runs to within ~18pt of the page edge, leaving no room
  // for the paragraph itself (matches how the real templates let this
  // section's text frame run onto the back page too).
  children.push(...bodyParagraphs(d.locationDescription))

  // --- Page 2: DESCRIPTION ---
  children.push(sectionHeading('DESCRIPTION'))
  children.push(...bodyParagraphs(d.propertyDescription))

  // --- Right-hand gallery column: 7.55cm tall, black border, 10pt gaps ---
  const galleryHeightPt = 7.55 * CM_TO_PT
  const galleryX = PAGE_WIDTH_PT - 300
  let galleryY = 20
  const galleryAll = [...galleryImgs, ...(floorPlanImg ? [floorPlanImg] : [])]
  for (const img of galleryAll) {
    const w = (galleryHeightPt * img.width) / img.height
    children.push(
      floatingImageParagraph({ bytes: img.bytes, type: img.type, xPt: galleryX, yPt: galleryY, widthPt: w, heightPt: galleryHeightPt, border: true })
    )
    galleryY += galleryHeightPt + 10
  }

  children.push(new Paragraph({ spacing: { before: Math.round(20 * PT_TO_TWIP), after: 0 }, children: [] }))
  children.push(availabilityTable(d, rateLabel, ratesPayable))
  children.push(new Paragraph({ spacing: { before: Math.round(30 * PT_TO_TWIP), after: 0 }, children: [] }))

  // --- Back logo + disclaimer (normal flow, not framed — the frame
  // position-drift issue above only got worse the more content preceded
  // it, and this is the very last thing on the page) ---
  children.push(
    floatingImageParagraph({ bytes: backLogoBytes, type: 'jpg', xPt: PAGE_WIDTH_PT - 210, yPt: 700, widthPt: 195, heightPt: 137 })
  )
  children.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      shading: { fill: 'FF0000' },
      children: [
        new TextRun({ text: 'Property Misrepresentation Act:  ', font: FONT, bold: true, size: 12, color: 'FFFFFF' }),
        new TextRun({ text: BROCHURE_DISCLAIMER.replace('Property Misrepresentation Act:  ', ''), font: FONT, size: 12, color: 'FFFFFF' }),
      ],
    })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
            margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
          },
        },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filename = `${d.address || 'Property'} - Brochure.docx`.replace(/[\\/:*?"<>|]/g, '')
  return { blob, filename }
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, bold: true, size: 16, underline: { type: 'thick', color: 'FF0000' } })],
  })
}

function bodyParagraphs(text: string): Paragraph[] {
  if (!text.trim()) return [new Paragraph({ spacing: { before: 0, after: 0 }, children: [] })]
  return [
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.BOTH,
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text, font: FONT, size: 15 })],
    }),
    new Paragraph({ spacing: { before: 0, after: 0 }, children: [] }),
  ]
}

function availabilityTable(d: BrochureData, rateLabel: string, ratesPayable: string | null): Table {
  const darkBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const headerRow = ['ADDRESS', rateLabel, 'RATEABLE VALUE', 'RATES PAYABLE (PA)']
  const dataRow = [d.address || '-', d.priceOrRent || '-', d.rateableValue ? `£${d.rateableValue}` : '-', ratesPayable ?? '-']
  return new Table({
    // Narrower than full width, left-aligned — the right-hand column of
    // the page is reserved for the floating photo gallery.
    width: { size: 5300, type: WidthType.DXA },
    alignment: AlignmentType.LEFT,
    borders: { top: darkBorder, bottom: darkBorder, left: darkBorder, right: darkBorder, insideHorizontal: darkBorder, insideVertical: darkBorder },
    rows: [
      new TableRow({
        children: headerRow.map(
          h =>
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: 'FF0000', font: FONT, size: 16 })] })],
            })
        ),
      }),
      new TableRow({
        children: dataRow.map(
          v =>
            new TableCell({
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: v, font: FONT, size: 16 })] })],
            })
        ),
      }),
    ],
  })
}

export function downloadBrochureDocx(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}

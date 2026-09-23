import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  DocumentGridType,
} from 'docx'
import { saveAs } from 'file-saver'
import type { ReportData } from '../components/PropertyReports/types'
import {
  SIGNATURE,
  RICS_DISCLAIMER,
  LEGAL_FEES,
  VIEWINGS,
  BEST_AND_FINAL,
  EPC_CLAUSE,
  AML_CLAUSE,
  CONCLUSION,
  MARKETING_COSTS_ROWS,
  MARKETING_INTRO,
  MARKETING_OUTRO,
} from './letterBoilerplate'
import {
  reLine,
  introParagraph,
  shortFormSummary,
  tenureParagraph,
  quotingTermsParagraph,
  conditionParagraph,
  servicesParagraph,
  measurementsParagraph,
} from './reportText'
import { MASON_YOUNG_LOGO_BASE64 } from '../assets/logoBase64'
import { LETTERHEAD_ADDRESS_BLOCK_BASE64 } from '../assets/letterheadAddressBase64'
import { MASON_YOUNG_FOOTER_BRAND_BASE64 } from '../assets/footerBrandBase64'
import { FOOTER_REGLINE_BASE64 } from '../assets/footerReglineBase64'
import { SIGNATURE_BASE64 } from '../assets/signatureBase64'

const FONT = 'Arial'
const SIZE = 20 // half-points; 20 = 10pt

// Page geometry (twips = 1/1440in) — A4, matching the real letterhead's own
// page size. Margins are the standard 1in on all sides (matching the real
// Moseley Road letter) rather than the narrower 0.79in the Sultan Vittoria
// Street letter happens to use — narrower margins make the body column
// WIDER, the opposite of what's needed here.
const PAGE_WIDTH_TWIPS = 11906
const PAGE_HEIGHT_TWIPS = 16838
const MARGIN_LEFT_TWIPS = 1440
const MARGIN_RIGHT_TWIPS = 1440
const MARGIN_TOP_TWIPS = 1440
// The footer's brand image (real letterhead offsets, see the footer
// paragraph below) floats upward about 997 twips past the normal bottom
// margin line. Without extra clearance here, body content that runs close
// to the page bottom (a signature block, for instance) visually collides
// with it — so the usable body area ends this much earlier.
const MARGIN_BOTTOM_TWIPS = 1440 + 1050
const HEADER_DISTANCE_TWIPS = 708
const FOOTER_DISTANCE_TWIPS = 708
const TWIP_TO_EMU = 635
// Bumped up from the real letterhead's exact 82x90pt — the user asked for
// the logo and the address/contact text under it to be bigger than a
// literal match — reverted: making both bigger required a large artificial
// gap before the body could start (to avoid the header colliding with the
// opening paragraph), which looked far worse than matching the template.
const LOGO_WIDTH_PT = 82
const LOGO_HEIGHT_PT = 90
// Tight-cropped to its actual text content (no padding) — the box used to
// be a fixed 150pt regardless of content, which was fine when the text
// inside was right-aligned (every line ended flush at the box's right
// edge, so the box's left edge — mostly empty space — never mattered). Now
// that the text is left-aligned to match the real letterhead, that empty
// space became the box's LEFT portion, pushing real ink further left than
// intended and into the "Re:" line's territory.
const ADDRESS_BLOCK_WIDTH_PT = 86
const ADDRESS_BLOCK_HEIGHT_PT = 70

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

function formatDateWithOrdinal(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleDateString('en-GB', { month: 'long' })
  const year = date.getFullYear()
  return `${day}${ordinalSuffix(day)} ${month} ${year}`
}

function base64ToBytes(dataUri: string): Uint8Array {
  const base64 = dataUri.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

// Matches the real Mason Young templates exactly: paragraphs carry no
// spacing.before/after of their own — every visual gap between a heading
// and its text, and between separate paragraphs, is a literal blank
// paragraph line. Confirmed by inspecting the source .doc's raw XML.
function plainRun(text: string): Paragraph {
  return new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text, font: FONT, size: SIZE })] })
}

function blank(): Paragraph {
  return plainRun('')
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, bold: true, underline: {}, font: FONT, size: SIZE })],
  })
}

/** Splits multi-paragraph text on \n and inserts a blank line between each. */
function bodyText(text: string): Paragraph[] {
  const lines = text.split('\n')
  const out: Paragraph[] = []
  lines.forEach((line, i) => {
    out.push(plainRun(line))
    if (i < lines.length - 1) out.push(blank())
  })
  return out
}

/** Heading, blank, body paragraphs (blank-separated), trailing blank. */
function section(title: string, ...bodies: string[]): Paragraph[] {
  const out: Paragraph[] = [heading(title), blank()]
  bodies.forEach((body, i) => {
    out.push(...bodyText(body))
    if (i < bodies.length - 1) out.push(blank())
  })
  out.push(blank())
  return out
}

// Exact values from the real letterhead's table XML: total width 6269
// twips split 5519/750 between the two columns (not an even 50/50 —
// "Description" needs the room, "Cost" doesn't), centered on the page,
// 1pt solid black borders, zero top/bottom cell padding (which is why real
// rows read as compact — no explicit row height needed, it's just
// single-line content with no padding to inflate it).
const TABLE_WIDTH_DXA = 6269
const TABLE_COL1_DXA = 5519
const TABLE_COL2_DXA = 750
const TABLE_CELL_MARGINS = { top: 0, bottom: 0, left: 108, right: 108, marginUnitType: WidthType.DXA }

function marketingTable(): Table {
  const darkBorder = { style: BorderStyle.SINGLE, size: 8, color: '000000' }
  const col1 = { size: TABLE_COL1_DXA, type: WidthType.DXA }
  const col2 = { size: TABLE_COL2_DXA, type: WidthType.DXA }
  return new Table({
    width: { size: TABLE_WIDTH_DXA, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    columnWidths: [TABLE_COL1_DXA, TABLE_COL2_DXA],
    margins: TABLE_CELL_MARGINS,
    borders: {
      top: darkBorder,
      bottom: darkBorder,
      left: darkBorder,
      right: darkBorder,
      insideHorizontal: darkBorder,
      insideVertical: darkBorder,
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: col1, children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, font: FONT, size: SIZE })] })] }),
          new TableCell({ width: col2, children: [new Paragraph({ children: [new TextRun({ text: 'Cost', bold: true, font: FONT, size: SIZE })] })] }),
        ],
      }),
      ...MARKETING_COSTS_ROWS.map(
        ([desc, cost]) =>
          new TableRow({
            children: [
              new TableCell({ width: col1, children: [new Paragraph({ children: [new TextRun({ text: desc, font: FONT, size: SIZE })] })] }),
              new TableCell({ width: col2, children: [new Paragraph({ children: [new TextRun({ text: cost, font: FONT, size: SIZE })] })] }),
            ],
          })
      ),
    ],
  })
}

// The logo and the address block below it share the same LEFT edge in the
// real letterhead (confirmed: the real XML's logo offset (4902200 EMU) and
// its address-block indent (7740 twips = 4914900 EMU) are within 1pt of
// each other) — both computed here as "flush against the right margin
// for something LOGO_WIDTH_PT wide", since that's what the logo itself is.
function letterheadColumnLeftOffsetEmu(): number {
  const usableWidthEmu = (PAGE_WIDTH_TWIPS - MARGIN_LEFT_TWIPS - MARGIN_RIGHT_TWIPS) * TWIP_TO_EMU
  return usableWidthEmu - LOGO_WIDTH_PT * 12700
}

// The address/contact block, pre-rendered to a single image (LEFT-aligned
// Arial 7pt, tight-cropped to content — real letters left-align this block
// rather than right-aligning it, confirmed by pixel-measuring the exemplar:
// every line starts at the same x, not ends at the same x). This is a
// deliberate departure from the real letterhead's raw XML, where these
// lines are plain text paragraphs: in THIS renderer, plain in-flow text
// paragraphs in the header — even ones matching the real file's structure
// paragraph-for-paragraph — measurably push the page's top margin down
// (verified: an empty header renders the body at 8.8% down the page, the
// same 10-line text block pushes it to 24%, while a floating IMAGE of any
// size verified at 0% extra push). A floating image is the only mechanism
// confirmed to contribute zero flow height, so the text is rendered once
// to a bitmap and floated exactly like the logo above it.
function letterheadAddressImage(): Paragraph {
  const widthPt = ADDRESS_BLOCK_WIDTH_PT
  const heightPt = ADDRESS_BLOCK_HEIGHT_PT
  const horizontalOffsetEmu = letterheadColumnLeftOffsetEmu()
  // Starts right below the logo. The naive "logo height + tiny nudge"
  // offset rendered a much bigger gap than the exemplar (measured: ours
  // ~69% of the logo's own height, exemplar's ~16%) — the second header
  // paragraph's own nominal line height adds to this offset, so it's
  // pulled back up to compensate and match the exemplar's tight spacing.
  const verticalOffsetEmu = (LOGO_HEIGHT_PT - 25) * 12700 + 6985

  return new Paragraph({
    children: [
      new ImageRun({
        data: base64ToBytes(LETTERHEAD_ADDRESS_BLOCK_BASE64),
        transformation: { width: widthPt, height: heightPt },
        type: 'png',
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: horizontalOffsetEmu },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: verticalOffsetEmu },
          allowOverlap: true,
          behindDocument: true,
          wrap: { type: TextWrappingType.NONE },
        },
      }),
    ],
  })
}

function logoParagraph(): Paragraph {
  // Matches the real letterhead exactly: the logo is a FLOATING image
  // (anchored, positioned absolutely, behind the text) rather than an
  // inline image sitting in the header's normal text flow. An inline
  // image at 90pt tall — plus the address block below it — pushes the
  // whole letter body down the page; a floating image doesn't consume
  // any flow height at all, which is why the real letter's body starts
  // right at the top margin instead of a couple of inches down.
  const horizontalOffsetEmu = letterheadColumnLeftOffsetEmu()

  return new Paragraph({
    children: [
      new ImageRun({
        data: base64ToBytes(MASON_YOUNG_LOGO_BASE64),
        transformation: { width: LOGO_WIDTH_PT, height: LOGO_HEIGHT_PT },
        type: 'jpg',
        // Vertical offset (6985 EMU, relative to the anchor paragraph) is
        // the exact value from the real letterhead's XML — it's a tiny
        // nudge independent of margin width, so it's safe to reuse as-is.
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: horizontalOffsetEmu },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 6985 },
          allowOverlap: true,
          behindDocument: true,
          wrap: { type: TextWrappingType.NONE },
        },
      }),
    ],
  })
}

// Arjamand's real signature, floated just below the "Yours sincerely" line
// it's anchored to (114300 EMU horizontal offset from the real letterhead's
// body XML; the vertical offset is enlarged from the real file's 116840 so
// it clears the "Yours sincerely" text instead of overlapping it). Size
// measured directly off a real rendered letter (82x60pt) rather than the
// XML's nominal 90x46.45pt — the real file's picture has a negative
// srcRect crop that stretches the visible ink past its nominal extent, so
// matching the XML numbers literally rendered visibly smaller than the
// real signature.
function signatureImageRun(): ImageRun {
  return new ImageRun({
    data: base64ToBytes(SIGNATURE_BASE64),
    transformation: { width: 82, height: 60 },
    type: 'png',
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: 114300 },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 260000 },
      allowOverlap: true,
      behindDocument: false,
      wrap: { type: TextWrappingType.NONE },
    },
  })
}

export async function generateReportDocx(d: ReportData): Promise<{ blob: Blob; filename: string }> {
  const isLong = d.formLength === 'long'
  const recipientAddress = (d.clientAddress.trim() || d.address).split(',').map(l => l.trim()).filter(Boolean)

  const bodySections: (Paragraph | Table)[] = []

  // Date, then the recipient's name and address, matching Mason Young's
  // standard letter opening.
  bodySections.push(plainRun(formatDateWithOrdinal(new Date())))
  bodySections.push(blank())
  if (d.clientName.trim()) bodySections.push(plainRun(d.clientName.trim()))
  for (const line of recipientAddress) bodySections.push(plainRun(line))
  bodySections.push(blank())

  bodySections.push(plainRun(d.clientSalutation || 'Dear Sir/Madam'))
  bodySections.push(blank())
  bodySections.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: reLine(d), bold: true, underline: {}, font: FONT, size: SIZE })],
    })
  )
  bodySections.push(blank())
  bodySections.push(...bodyText(introParagraph(d)))
  bodySections.push(blank())

  if (isLong) {
    bodySections.push(...section('Location', d.locationDescription || '[Location description not yet generated]'))
    bodySections.push(...section('The Property', d.propertyDescription || '[Property description not yet generated]', measurementsParagraph(d)))
    bodySections.push(...section('Services', servicesParagraph(d)))
    bodySections.push(...section('Tenure', tenureParagraph(d)))
    bodySections.push(...section('Condition of the premises', conditionParagraph(d)))
    bodySections.push(...section('Quoting Terms & Fees', quotingTermsParagraph(d), RICS_DISCLAIMER))

    bodySections.push(heading('Marketing'), blank(), ...bodyText(MARKETING_INTRO), blank())
    bodySections.push(marketingTable())
    bodySections.push(blank(), ...bodyText(MARKETING_OUTRO), blank())
  } else {
    bodySections.push(...bodyText(shortFormSummary(d)), blank())
    bodySections.push(...bodyText(RICS_DISCLAIMER), blank())
    bodySections.push(...bodyText(quotingTermsParagraph(d)), blank())
  }

  bodySections.push(...section('Legal Fees', LEGAL_FEES))
  bodySections.push(...section('Viewings', VIEWINGS))
  bodySections.push(...section('Best & Final Offers', BEST_AND_FINAL))
  bodySections.push(...section('Other Matters for Consideration', EPC_CLAUSE, AML_CLAUSE))
  bodySections.push(...section('Conclusion', CONCLUSION))

  bodySections.push(
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [new TextRun({ text: 'Yours sincerely', font: FONT, size: SIZE }), signatureImageRun()],
    }),
    blank(),
    blank(),
    blank(),
    blank(),
    blank()
  )
  bodySections.push(
    plainRun(SIGNATURE.name),
    plainRun(SIGNATURE.title),
    plainRun(SIGNATURE.team),
    plainRun(SIGNATURE.company),
    plainRun(`DDI : ${SIGNATURE.ddi}`),
    plainRun(`E-mail : ${SIGNATURE.email}`),
    blank()
  )
  bodySections.push(plainRun('I agree to the Agency Appointment and Terms as provided above in regard to the disposal of the property.'))
  bodySections.push(blank(), blank())
  bodySections.push(plainRun('Signed ……………………………………………………..'))
  bodySections.push(blank(), blank())
  bodySections.push(plainRun('PRINT NAME …………………………………………..'))
  bodySections.push(blank(), blank())
  bodySections.push(plainRun('Date ……………………………………………………..'))

  // Plain-paragraph spacing before/after had NO effect on where this text
  // actually rendered in the footer (verified: identical pixel position
  // with spacing.before at 0 and at 500 twips) — this renderer pins
  // footer paragraph text to a fixed position independent of preceding
  // content. So, like the address block, the trading-name text is
  // rendered once to a bitmap and floated with an explicit offset,
  // exactly like the brand-list image next to it — the only mechanism
  // that's actually controllable here.
  const footerListImageVerticalOffsetEmu = -633095
  const footerListHeightPt = 73
  // Measured from the exemplar: the trading-name text starts about 73% of
  // the way down the 6-item brand list, not top-aligned with it.
  const footerTextVerticalOffsetEmu = footerListImageVerticalOffsetEmu + Math.round(0.73 * footerListHeightPt * 12700)

  const footer = new Footer({
    children: [
      new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: base64ToBytes(MASON_YOUNG_FOOTER_BRAND_BASE64),
            transformation: { width: 90, height: footerListHeightPt },
            type: 'jpg',
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: -114300 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: footerListImageVerticalOffsetEmu },
              allowOverlap: true,
              behindDocument: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
          new ImageRun({
            data: base64ToBytes(FOOTER_REGLINE_BASE64),
            transformation: { width: 361, height: 24 },
            type: 'png',
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: 1143000 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: footerTextVerticalOffsetEmu },
              allowOverlap: true,
              behindDocument: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
        ],
      }),
    ],
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
          // Every body paragraph in the real letters is fully justified
          // ("jc=both" in the raw XML, confirmed from Location onward
          // through the signature block) — not left-aligned/ragged-right.
          paragraph: { alignment: AlignmentType.BOTH },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            size: { width: PAGE_WIDTH_TWIPS, height: PAGE_HEIGHT_TWIPS },
            margin: {
              top: MARGIN_TOP_TWIPS,
              bottom: MARGIN_BOTTOM_TWIPS,
              left: MARGIN_LEFT_TWIPS,
              right: MARGIN_RIGHT_TWIPS,
              header: HEADER_DISTANCE_TWIPS,
              footer: FOOTER_DISTANCE_TWIPS,
            },
          },
          grid: { type: DocumentGridType.DEFAULT, linePitch: 360 },
        },
        headers: {
          // Logo + address + contact block appears once, on page 1 only —
          // no header at all on continuation pages. (Reusing the same
          // embedded image in a second header was also causing it to
          // render washed-out/grey — a single ImageRun avoids that too.)
          first: new Header({ children: [logoParagraph(), letterheadAddressImage()] }),
          default: new Header({ children: [] }),
        },
        footers: { default: footer, first: footer },
        children: bodySections,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const filenameAddress = (d.address || 'property').replace(/[^a-z0-9]+/gi, '_').slice(0, 60)
  const filename = `${filenameAddress}_${d.disposalType}_${d.formLength}.docx`
  return { blob, filename }
}

export function downloadDocx(blob: Blob, filename: string): void {
  saveAs(blob, filename)
}

/**
 * Uploads the generated document to short-lived Blob storage and launches
 * it directly in the Word desktop app via the ms-word: URI scheme (the same
 * mechanism OneDrive/SharePoint use for "Open in Desktop App"). Requires
 * Word to be installed and registered as the handler; falls back silently
 * if not — callers should always also offer downloadDocx as a fallback.
 */
export async function openInWordDesktop(blob: Blob, filename: string): Promise<void> {
  const res = await fetch(`/api/upload-draft?filename=${encodeURIComponent(filename)}`, {
    method: 'POST',
    body: blob,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Could not prepare the document for Word')

  const wordUri = `ms-word:ofe|u|${encodeURIComponent(json.url)}`
  window.location.href = wordUri
}

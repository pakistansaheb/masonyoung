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
} from 'docx'
import { saveAs } from 'file-saver'
import type { ReportData } from '../components/PropertyReports/types'
import {
  LETTERHEAD,
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

const RED = 'C8102E'
const FONT = 'Arial'
const SIZE = 20 // half-points; 20 = 10pt

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

function marketingTable(): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      left: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      right: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '999999' },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true, font: FONT, size: SIZE })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'Cost', bold: true, font: FONT, size: SIZE })] })] }),
        ],
      }),
      ...MARKETING_COSTS_ROWS.map(
        ([desc, cost]) =>
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: desc, font: FONT, size: SIZE })] })] }),
              new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cost, font: FONT, size: SIZE })] })] }),
            ],
          })
      ),
    ],
  })
}

function rightAlignedLine(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, font: FONT, size: SIZE })],
  })
}

function letterheadAddressBlock(): Paragraph[] {
  return [
    ...LETTERHEAD.addressLines.map(rightAlignedLine),
    rightAlignedLine(''),
    rightAlignedLine(`T: ${LETTERHEAD.tel}`),
    rightAlignedLine(`F: ${LETTERHEAD.fax}`),
    rightAlignedLine(`E: ${LETTERHEAD.email}`),
    rightAlignedLine(`W: ${LETTERHEAD.web}`),
  ]
}

function logoParagraph(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new ImageRun({ data: base64ToBytes(MASON_YOUNG_LOGO_BASE64), transformation: { width: 90, height: 74 }, type: 'jpg' })],
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

    bodySections.push(heading('Marketing Costs'), blank(), ...bodyText(MARKETING_INTRO), blank())
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

  bodySections.push(plainRun('Yours sincerely'), blank(), blank(), blank(), blank(), blank())
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

  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: RED } },
        spacing: { before: 100 },
        children: [new TextRun({ text: LETTERHEAD.regLine, font: FONT, size: 12, color: '888888' })],
      }),
    ],
  })

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: SIZE },
        },
      },
    },
    sections: [
      {
        properties: { titlePage: true },
        headers: {
          // Logo + address + contact block appears once, on page 1 only —
          // no header at all on continuation pages. (Reusing the same
          // embedded image in a second header was also causing it to
          // render washed-out/grey — a single ImageRun avoids that too.)
          first: new Header({ children: [logoParagraph(), ...letterheadAddressBlock()] }),
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

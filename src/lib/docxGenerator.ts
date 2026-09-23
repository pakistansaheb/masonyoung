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

function bodyText(text: string): Paragraph[] {
  return text.split('\n').map(
    line =>
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: line, font: FONT, size: SIZE })],
      })
  )
}

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, bold: true, underline: {}, font: FONT, size: SIZE })],
  })
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

function plainRun(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, font: FONT, size: SIZE })], spacing: { after: 0 } })
}

export async function generateReportDocx(d: ReportData): Promise<{ blob: Blob; filename: string }> {
  const logoBytes = base64ToBytes(MASON_YOUNG_LOGO_BASE64)

  const isLong = d.formLength === 'long'

  const bodySections: (Paragraph | Table)[] = []

  // Date, then the recipient's name and address, matching Mason Young's
  // standard letter opening — the app previously skipped straight to the
  // salutation with no date or address block above it.
  bodySections.push(new Paragraph({ children: [new TextRun({ text: formatDateWithOrdinal(new Date()), font: FONT, size: SIZE })], spacing: { after: 400 } }))
  if (d.clientName.trim()) bodySections.push(plainRun(d.clientName.trim()))
  for (const line of d.address.split(',').map(l => l.trim()).filter(Boolean)) {
    bodySections.push(plainRun(line))
  }
  bodySections.push(new Paragraph({ text: '', spacing: { after: 300 } }))

  bodySections.push(
    new Paragraph({ children: [new TextRun({ text: d.clientSalutation || 'Dear Sir/Madam', font: FONT, size: SIZE })], spacing: { after: 300 } })
  )
  bodySections.push(
    new Paragraph({
      children: [new TextRun({ text: reLine(d), bold: true, underline: {}, font: FONT, size: SIZE })],
      spacing: { after: 300 },
    })
  )
  bodySections.push(...bodyText(introParagraph(d)))

  if (isLong) {
    bodySections.push(heading('Location'))
    bodySections.push(...bodyText(d.locationDescription || '[Location description not yet generated]'))

    bodySections.push(heading('The Property'))
    bodySections.push(...bodyText(d.propertyDescription || '[Property description not yet generated]'))
    bodySections.push(...bodyText(measurementsParagraph(d)))

    bodySections.push(heading('Services'))
    bodySections.push(...bodyText(servicesParagraph(d)))

    bodySections.push(heading('Tenure'))
    bodySections.push(...bodyText(tenureParagraph(d)))

    bodySections.push(heading('Condition of the premises'))
    bodySections.push(...bodyText(conditionParagraph(d)))

    bodySections.push(heading('Quoting Terms & Fees'))
    bodySections.push(...bodyText(quotingTermsParagraph(d)))
    bodySections.push(...bodyText(RICS_DISCLAIMER))

    bodySections.push(heading('Marketing Costs'))
    bodySections.push(...bodyText(MARKETING_INTRO))
    bodySections.push(marketingTable())
    bodySections.push(...bodyText(MARKETING_OUTRO))
  } else {
    bodySections.push(...bodyText(shortFormSummary(d)))
    bodySections.push(...bodyText(RICS_DISCLAIMER))
    bodySections.push(...bodyText(quotingTermsParagraph(d)))
  }

  bodySections.push(heading('Legal Fees'))
  bodySections.push(...bodyText(LEGAL_FEES))

  bodySections.push(heading('Viewings'))
  bodySections.push(...bodyText(VIEWINGS))

  bodySections.push(heading('Best & Final Offers'))
  bodySections.push(...bodyText(BEST_AND_FINAL))

  bodySections.push(heading('Other Matters for Consideration'))
  bodySections.push(...bodyText(EPC_CLAUSE))
  bodySections.push(...bodyText(AML_CLAUSE))

  bodySections.push(heading('Conclusion'))
  bodySections.push(...bodyText(CONCLUSION))

  bodySections.push(
    new Paragraph({ text: 'Yours sincerely', spacing: { before: 300, after: 600 } }),
    new Paragraph({ text: SIGNATURE.name, spacing: { after: 0 } }),
    new Paragraph({ text: SIGNATURE.title, spacing: { after: 0 } }),
    new Paragraph({ text: SIGNATURE.team, spacing: { after: 0 } }),
    new Paragraph({ text: SIGNATURE.company, spacing: { after: 0 } }),
    new Paragraph({ text: `DDI : ${SIGNATURE.ddi}`, spacing: { after: 0 } }),
    new Paragraph({ text: `E-mail : ${SIGNATURE.email}`, spacing: { after: 400 } }),
    new Paragraph({
      text: 'I agree to the Agency Appointment and Terms as provided above in regard to the disposal of the property.',
      spacing: { after: 400 },
    }),
    new Paragraph({ text: 'Signed ……………………………………………………..', spacing: { after: 300 } }),
    new Paragraph({ text: 'PRINT NAME …………………………………………..', spacing: { after: 300 } }),
    new Paragraph({ text: 'Date ……………………………………………………..' })
  )

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
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new ImageRun({
                    data: logoBytes,
                    transformation: { width: 90, height: 74 },
                    type: 'jpg',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: RED } },
                spacing: { before: 100 },
                children: [new TextRun({ text: LETTERHEAD.regLine, font: FONT, size: 12, color: '888888' })],
              }),
            ],
          }),
        },
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

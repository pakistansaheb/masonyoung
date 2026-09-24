// Low-level XML-string surgery for editing a real Mason Young brochure
// template in place. Deliberately NOT a DOM parser: Word's own document.xml
// routinely splits a single sentence across many <w:r> runs (spell-check /
// revision artifacts — confirmed by inspecting the real templates, e.g. an
// address ending "...BIRMINGHAM, B1 3AJ" split mid-word across two runs),
// so matching old TEXT content is fragile. Every replacement here instead
// anchors on a STABLE, single-run marker string (a heading like "LOCATION",
// a placeholder like "ADDRESS", or a distinctive whole run like "SQ FT (SQ
// M)") and operates on paragraph/run BOUNDARIES relative to that anchor —
// never on the arbitrary old text in between.

/** Index of the `<w:p ...>` or `<w:p>` tag that opens the paragraph containing `charIndex`. */
function paragraphStart(xml: string, charIndex: number): number {
  const i = xml.lastIndexOf('<w:p ', charIndex)
  const j = xml.lastIndexOf('<w:p>', charIndex)
  const start = Math.max(i, j)
  if (start === -1) throw new Error('paragraphStart: no enclosing <w:p> found')
  return start
}

/** Index just after the `</w:p>` that closes the paragraph containing `charIndex`. */
function paragraphEnd(xml: string, charIndex: number): number {
  const end = xml.indexOf('</w:p>', charIndex)
  if (end === -1) throw new Error('paragraphEnd: no closing </w:p> found')
  return end + '</w:p>'.length
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Builds a single run-styled paragraph, matching the plain body-text style used throughout these templates. */
function buildBodyParagraph(text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): string {
  const { bold = false, color, size = 15 } = opts
  const rPr = `<w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/>${bold ? '<w:b/>' : ''}${
    color ? `<w:color w:val="${color}"/>` : ''
  }<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`
  return `<w:p><w:pPr><w:jc w:val="both"/></w:pPr><w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

/**
 * Replaces every paragraph strictly between the paragraph containing
 * `afterMarker` and the paragraph containing `beforeMarker` with new body
 * paragraphs — one per line of `text`. Used for LOCATION/DESCRIPTION/etc:
 * the heading itself (afterMarker) and the next heading (beforeMarker) are
 * both left completely untouched; only the real-example text between them
 * is swapped out.
 */
export function replaceSectionBody(xml: string, afterMarker: string, beforeMarker: string, text: string): string {
  const afterIdx = xml.indexOf(afterMarker)
  if (afterIdx === -1) throw new Error(`replaceSectionBody: afterMarker not found: ${afterMarker}`)
  const beforeIdx = xml.indexOf(beforeMarker, afterIdx)
  if (beforeIdx === -1) throw new Error(`replaceSectionBody: beforeMarker not found: ${beforeMarker}`)

  const from = paragraphEnd(xml, afterIdx)
  const to = paragraphStart(xml, beforeIdx)
  const lines = text.split('\n').filter(l => l.trim())
  const newParas = lines.map(l => buildBodyParagraph(l)).join('')
  return xml.slice(0, from) + newParas + xml.slice(to)
}

/**
 * Removes an ENTIRE section — its heading paragraph included — when there's
 * no real data to put in it. Used instead of replaceSectionBody whenever
 * the section's content depends on user input that wasn't given (an empty
 * LOCATION description, no accommodation figures, no price/rent, no
 * rateable value): a brochure someone only half-fills in should read like
 * a shorter, complete document, not show "[PRICE]"-style placeholders or
 * a heading over a blank paragraph.
 */
export function removeSection(xml: string, headingMarker: string, nextHeadingMarker: string): string {
  const headingIdx = xml.indexOf(headingMarker)
  if (headingIdx === -1) throw new Error(`removeSection: headingMarker not found: ${headingMarker}`)
  const nextIdx = xml.indexOf(nextHeadingMarker, headingIdx)
  if (nextIdx === -1) throw new Error(`removeSection: nextHeadingMarker not found: ${nextHeadingMarker}`)

  const from = paragraphStart(xml, headingIdx)
  const to = paragraphStart(xml, nextIdx)
  return xml.slice(0, from) + xml.slice(to)
}

/** Replaces the single paragraph containing `marker` with new body paragraphs, one per line of `text`. */
export function replaceParagraphAt(xml: string, marker: string, text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): string {
  const idx = xml.indexOf(marker)
  if (idx === -1) throw new Error(`replaceParagraphAt: marker not found: ${marker}`)
  const from = paragraphStart(xml, idx)
  const to = paragraphEnd(xml, idx)
  const lines = text.split('\n').filter(l => l.trim())
  const newParas = lines.map(l => buildBodyParagraph(l, opts)).join('')
  return xml.slice(0, from) + newParas + xml.slice(to)
}

/**
 * Replaces the nearest paragraph with actual text content BEFORE the one
 * containing `marker`, skipping any blank spacer paragraphs in between —
 * used for the cover's ADDRESS line, where the old text is a real, often
 * run-fragmented example address (not a clean placeholder token), and the
 * templates sometimes have an empty spacer paragraph between it and the
 * sq-ft line. Its paragraph's *position* relative to the sq-ft line is
 * stable even though its exact text/run-splitting isn't.
 */
export function replaceParagraphBefore(xml: string, marker: string, text: string, opts: { bold?: boolean; color?: string; size?: number } = {}): string {
  const idx = xml.indexOf(marker)
  if (idx === -1) throw new Error(`replaceParagraphBefore: marker not found: ${marker}`)
  let cursor = paragraphStart(xml, idx)

  // Walk backward past any paragraph that has no visible <w:t> text.
  let from: number
  for (;;) {
    from = paragraphStart(xml, cursor - 1)
    const to = paragraphEnd(xml, from)
    const para = xml.slice(from, to)
    if (/<w:t[^>]*>[^<]*[^\s<][^<]*<\/w:t>/.test(para)) break
    cursor = from
  }
  const to = paragraphStart(xml, idx)
  return xml.slice(0, from) + buildBodyParagraph(text, opts) + xml.slice(to)
}

function nthIndexOf(xml: string, marker: string, n: number): number {
  let idx = -1
  for (let i = 0; i <= n; i++) {
    idx = xml.indexOf(marker, idx + 1)
    if (idx === -1) throw new Error(`nthIndexOf: occurrence ${n} of "${marker}" not found`)
  }
  return idx
}

/** Removes the paragraph containing the FIRST remaining occurrence of `marker` outright (no replacement) — used to drop unused bullet-point placeholders instead of leaving literal "BULLET POINT" text visible. */
export function removeParagraphAt(xml: string, marker: string): string {
  const idx = xml.indexOf(marker)
  if (idx === -1) throw new Error(`removeParagraphAt: marker not found: ${marker}`)
  const from = paragraphStart(xml, idx)
  const to = paragraphEnd(xml, idx)
  return xml.slice(0, from) + xml.slice(to)
}

/**
 * Replaces the TEXT of the Nth (0-indexed) occurrence of a paragraph
 * containing `marker`, keeping that paragraph's <w:pPr> completely intact
 * (its numbering reference, indentation, everything) and reusing its first
 * run's <w:rPr> for the new text. Used for the bullet points, whose
 * red-square glyph comes from a numPr numbering reference in pPr — losing
 * that would silently turn a bullet into a plain paragraph.
 */
export function replaceParagraphTextKeepPPr(xml: string, marker: string, newText: string, occurrence = 0): string {
  const idx = nthIndexOf(xml, marker, occurrence)
  const pStart = paragraphStart(xml, idx)
  const pEnd = paragraphEnd(xml, idx)
  const paraXml = xml.slice(pStart, pEnd)
  const pPrMatch = paraXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)
  const pPr = pPrMatch ? pPrMatch[0] : ''
  const rPrMatch = paraXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
  const rPr = rPrMatch ? rPrMatch[0] : ''
  const pTagMatch = paraXml.match(/^<w:p[^>]*>/)
  const pTag = pTagMatch ? pTagMatch[0] : '<w:p>'
  const newPara = `${pTag}${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r></w:p>`
  return xml.slice(0, pStart) + newPara + xml.slice(pEnd)
}

/** Replaces the Nth (0-indexed) occurrence of `marker` in the whole document with `replacement` (plain substring swap, not XML-aware — only safe for short, exact, single-run tokens). */
export function replaceNthLiteral(xml: string, marker: string, replacement: string, n: number): string {
  let idx = -1
  for (let i = 0; i <= n; i++) {
    idx = xml.indexOf(marker, idx + 1)
    if (idx === -1) throw new Error(`replaceNthLiteral: occurrence ${n} of "${marker}" not found`)
  }
  return xml.slice(0, idx) + replacement + xml.slice(idx + marker.length)
}

/** Replaces every occurrence of an exact literal substring (safe only for short, distinctive, single-run tokens like a placeholder £ figure). */
export function replaceAllLiteral(xml: string, marker: string, replacement: string): string {
  if (!xml.includes(marker)) throw new Error(`replaceAllLiteral: marker not found: ${marker}`)
  return xml.split(marker).join(replacement)
}

/**
 * Sets each cell's text in a row, in cell order. If a cell already has a
 * run, its text is replaced in place (keeping that run's own rPr/style).
 * If a cell's paragraph is EMPTY (confirmed real case: the LFS template
 * ships its ACCOMMODATION table with a header row but blank floor/TOTAL
 * rows — no runs at all to "replace"), a new run is inserted using
 * `fallbackRPr` so the cell actually gets visible text instead of quietly
 * staying blank.
 */
function setCellTexts(rowXml: string, texts: string[], fallbackRPr: string): string {
  let i = 0
  return rowXml.replace(/<w:tc>[\s\S]*?<\/w:tc>/g, cellXml => {
    if (i >= texts.length) return cellXml
    const text = texts[i++]
    if (/<w:t[^>]*>[^<]*<\/w:t>/.test(cellXml)) {
      let replaced = false
      return cellXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/, (m, attrs: string) => {
        if (replaced) return m
        replaced = true
        return `<w:t${attrs}>${escapeXml(text)}</w:t>`
      })
    }
    // No run to replace — insert one right before the paragraph's close.
    const pCloseIdx = cellXml.lastIndexOf('</w:p>')
    if (pCloseIdx === -1) return cellXml
    const newRun = `<w:r><w:rPr>${fallbackRPr}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`
    return cellXml.slice(0, pCloseIdx) + newRun + cellXml.slice(pCloseIdx)
  })
}

/**
 * Rebuilds the ACCOMMODATION table (AREA / SQ FT / SQ M) to have one row
 * per floor that has a value, plus a TOTAL row — matching the real
 * templates exactly (they ship with a single example floor row + TOTAL;
 * this clones the floor row's own XML, so its exact cell borders/fonts/
 * widths are preserved for every additional row).
 */
export function rebuildAccommodationTable(
  xml: string,
  floors: { label: string; sqFt: string; sqM: string }[],
  total: { sqFt: string; sqM: string }
): string {
  const tblMatch = xml.match(/<w:tbl>[\s\S]*?<\/w:tbl>/)
  if (!tblMatch) throw new Error('rebuildAccommodationTable: no <w:tbl> found')
  const tbl = tblMatch[0]
  const tblStart = tblMatch.index!

  const rows = tbl.match(/<w:tr [\s\S]*?<\/w:tr>/g)
  if (!rows || rows.length < 3) throw new Error(`rebuildAccommodationTable: expected >=3 rows, found ${rows?.length}`)
  const headerRow = rows[0]
  const floorTemplateRow = rows[1]
  const totalTemplateRow = rows[rows.length - 1]

  // The header row always has real runs in every template — reuse its
  // (non-bold-stripped) rPr as the fallback style for any cell that needs
  // a run inserted from scratch.
  const headerRPrMatch = headerRow.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)
  const dataRPr = (headerRPrMatch ? headerRPrMatch[0] : '<w:rPr/>').replace(/<w:b\/>/, '')
  const totalRPr = headerRPrMatch ? headerRPrMatch[0] : '<w:rPr/>'

  const preamble = tbl.slice('<w:tbl>'.length, tbl.indexOf('<w:tr '))
  const floorRows = floors.map(f => setCellTexts(floorTemplateRow, [f.label, f.sqFt || '-', f.sqM || '-'], dataRPr)).join('')
  const totalRow = setCellTexts(totalTemplateRow, ['TOTAL', total.sqFt || '-', total.sqM || '-'], totalRPr)

  const newTbl = `<w:tbl>${preamble}${headerRow}${floorRows}${totalRow}</w:tbl>`
  return xml.slice(0, tblStart) + newTbl + xml.slice(tblStart + tbl.length)
}

/** Builds the <w:r><w:drawing>... run for one absolutely-positioned, non-wrapping picture with a black border, cloned from the real templates' own logo-image drawing structure. */
export function buildPictureRun(opts: {
  rId: string
  docPrId: number
  xEmu: number
  yEmu: number
  widthEmu: number
  heightEmu: number
  border?: boolean
}): string {
  const outline = opts.border
    ? '<a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln>'
    : ''
  return (
    '<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>' +
    `<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="${251900000 + opts.docPrId}" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">` +
    '<wp:simplePos x="0" y="0"/>' +
    `<wp:positionH relativeFrom="column"><wp:posOffset>${opts.xEmu}</wp:posOffset></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${opts.yEmu}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${opts.widthEmu}" cy="${opts.heightEmu}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    '<wp:wrapNone/>' +
    `<wp:docPr id="${opts.docPrId}" name="Picture ${opts.docPrId}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="0" name="Picture ${opts.docPrId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${opts.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${opts.widthEmu}" cy="${opts.heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${outline}</pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>'
  )
}

/** Inserts a single-paragraph run right after the paragraph containing `marker` (e.g. right after the ACCOMMODATION heading's paragraph). */
export function insertParagraphAfter(xml: string, marker: string, runXml: string): string {
  const idx = xml.indexOf(marker)
  if (idx === -1) throw new Error(`insertParagraphAfter: marker not found: ${marker}`)
  const at = paragraphEnd(xml, idx)
  return xml.slice(0, at) + `<w:p>${runXml}</w:p>` + xml.slice(at)
}

/** Finds the highest numeric rId already used in a relationships XML file, so new ones can't collide. */
export function nextRelationshipId(relsXml: string): number {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(m => Number(m[1]))
  return (ids.length ? Math.max(...ids) : 0) + 1
}

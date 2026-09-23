import type { ReportData } from '../components/PropertyReports/types'

const disposalLabel: Record<ReportData['disposalType'], string> = {
  freehold: 'FREEHOLD',
  leasehold: 'LEASEHOLD',
  long_leasehold: 'LEASEHOLD & LONG LEASEHOLD',
  lease_assignment: 'LEASE FOR SALE',
}

const disposalBasis: Record<ReportData['disposalType'], string> = {
  freehold: 'freehold',
  leasehold: 'leasehold',
  long_leasehold: 'long leasehold or leasehold',
  lease_assignment: 'assignment',
}

export function reLine(d: ReportData): string {
  return `Re: ${d.address.toUpperCase()} - ${disposalLabel[d.disposalType]} DISPOSAL`
}

export function introParagraph(d: ReportData): string {
  if (d.formLength === 'short') {
    return `Many thanks for allowing me to inspect the premises above. You have requested advice in relation to the disposal of the premises on a ${disposalBasis[d.disposalType]} basis. I write to confirm our formal Terms and Conditions and fee basis for Agency services only.`
  }
  return `Thank you for allowing me to inspect the premises above. You have requested advice in relation to the disposal of the commercial premises on a ${disposalBasis[d.disposalType]} basis. I confirm that I have now had the opportunity to consider the accommodation relative to the current market conditions and would comment as follows.`
}

export function shortFormSummary(d: ReportData): string {
  const priceOrRent =
    d.disposalType === 'freehold'
      ? `a quoting price of £${d.quotingPrice || '[PRICE]'} with a view to achieving a figure in the region of £${d.targetPrice || '[PRICE]'}`
      : `a quoting rent of £${d.quotingRent || '[RENT]'} per annum exclusive with a view to achieving a figure in the region of £${d.targetRent || '[RENT]'} per annum exclusive`
  return `As the property and location are well known to you, I will not be going into too much detail save to say that the area measures approximately ${d.totalSqFt || '[AREA]'} sq ft. I would suggest marketing the property at ${priceOrRent}.`
}

export function tenureParagraph(d: ReportData): string {
  if (d.tenureNotes.trim()) return d.tenureNotes
  switch (d.disposalType) {
    case 'freehold':
      return 'Although I have not seen any official title documents, I have been informed by you that the property is held Freehold. I understand that there is no lease in place and that the property is available For Sale with immediate effect.'
    case 'long_leasehold':
      return `From the information you have provided, I understand that the premises are held on a long lease${d.leaseExpiry ? `, expiring ${d.leaseExpiry}` : ''}.${d.groundRent ? ` There is a ground rent payable of £${d.groundRent} per annum, subject to rent reviews every ${d.groundRentReviewYears || '7'} years.` : ''} I have not had sight of the ground lease and will require a copy before commencing marketing.`
    case 'lease_assignment':
      return `The property is held on an existing lease${d.leaseExpiry ? `, which expires on ${d.leaseExpiry}` : ''}. Based on this, we would either be looking to assign the remainder of the term or create a new sub-lease. If a longer term is required by the incoming tenant, then a possible surrender and new lease will have to be negotiated directly with the landlord, subject to confirming covenant strength. We will need to seek landlords' consent in any event.`
    case 'leasehold':
    default:
      return "From the information you have provided, I understand that the premises are held Freehold. I have not had sight of the title deeds and will require a copy before commencing marketing. We would be grateful if you could confirm the annual building insurance payable for the property."
  }
}

export function quotingTermsParagraph(d: ReportData): string {
  const disposalWord = d.disposalType === 'long_leasehold' ? 'long leasehold or leasehold' : disposalBasis[d.disposalType]

  if (d.disposalType === 'freehold') {
    return `I understand that you wish to dispose of the property on a Freehold basis. I believe if this property were to be placed on the open market there would be a lot of interest. Many owner-occupiers are looking for their own premises as well as investors.\nHaving carried out my research in the area, I would suggest marketing the unit at a quoting price of £${d.quotingPrice || '[PRICE]'} with a view to achieving a figure in the region of £${d.targetPrice || '[PRICE]'}. I would propose that professional fees in respect of a freehold disposal on a sole agency basis would be equivalent to ${d.saleFeePercent}% of the final sale price agreed. All fees are exclusive of VAT and any agreed marketing expenses.`
  }

  if (d.disposalType === 'lease_assignment') {
    return `I would propose that the professional fees to dispose of the remaining leasehold interest on a sole agency basis would be based upon ${d.lettingFeeFirstYearPercent || '12.5'}% of the passing rent${d.premium ? ` and 5% of the final premium paid` : ''}. All fees would be exclusive of incentives, VAT and any agreed marketing expenses.`
  }

  const managed = d.managedService
    ? ` Should you wish for us to provide you with a managed service; we would look to reduce our initial letting fee to ${d.managedServiceLettingFeePercent}% on the same basis as outlined above and also charge an ${d.managementFeePercent}% annual management fee which would cover rent collections, periodic inspections and any other issues which may arise.`
    : ''

  const saleClause =
    d.disposalType === 'long_leasehold' && d.quotingPrice
      ? ` I would suggest marketing the property at a quoting price of £${d.quotingPrice} with a view to agreeing anything in the region of £${d.targetPrice || d.quotingPrice}. This would be for the property as it stands, with vacant possession.`
      : ''

  return `I understand that you wish to dispose of the property on a ${disposalWord} basis. Having carried out my research in the area, I would suggest a quoting rent of £${d.quotingRent || '[RENT]'} per annum exclusive with a view to agreeing a rent in the region of £${d.targetRent || '[RENT]'} per annum exclusive.${saleClause} We may have to offer incentives to get the deal done however this would be subject to covenant strength & terms.\nI would propose that our professional fees in respect of a ${d.disposalType === 'long_leasehold' ? 'long leasehold' : 'leasehold'} disposal on a sole agency basis would be equivalent to ${d.lettingFeeFirstYearPercent}% of the rental agreed for the first year or in the case of a 'stepped rental' deal, the average rent across the period until the first review or lease expiry.${managed} All fees would be exclusive of incentives, VAT and any agreed marketing expenses.`
}

export function conditionParagraph(d: ReportData): string {
  return `I have not carried out a building survey although would comment that ${d.conditionNotes}.`
}

export function servicesParagraph(d: ReportData): string {
  return `We are advised all services are connected to include ${d.servicesNotes}.`
}

export function measurementsParagraph(d: ReportData): string {
  const parts: string[] = []
  if (d.groundFloorSqFt) parts.push(`the ground floor measures approximately ${d.groundFloorSqFt} sq ft`)
  if (d.firstFloorSqFt) parts.push(`the first floor measures approximately ${d.firstFloorSqFt} sq ft`)
  if (d.otherFloorSqFt) parts.push(`there is a further ${d.otherFloorSqFt} sq ft`)
  const detail = parts.length ? `From measurements taken on site, we have calculated that ${parts.join(', ')}, providing a total of approximately ${d.totalSqFt || '[TOTAL]'} sq ft. ` : ''
  return `${detail}All measurements were calculated on a ${d.measurementBasis} area basis.`
}

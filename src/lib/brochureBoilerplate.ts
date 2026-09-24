import type { BrochureDisposalType } from '../components/PropertyBrochures/types'

// Pulled directly from the real exemplar brochures (Northside Business
// Centre = TO LET, Bristol Road = TO LET, blank templates FH/LFS/LH).
export const BROCHURE_HEADING: Record<BrochureDisposalType, string> = {
  freehold: 'FOR SALE',
  leasehold: 'TO LET',
  lease_assignment: 'LEASE FOR SALE',
}

export const BROCHURE_RATE_COLUMN_LABEL: Record<BrochureDisposalType, string> = {
  freehold: 'PRICE',
  leasehold: 'RENT PA',
  lease_assignment: 'PRICE',
}

// Verbatim from the real Northside/Bristol Road exemplars' back page.
export const BROCHURE_DISCLAIMER =
  'Property Misrepresentation Act:  Mason Young Property Consultants for themselves and for the vendors or lessors of this property, whose agents they are, give notice that: (I) these particulars are for guidance only and do not constitute any part of an offer or contract. (II) all descriptions, dimensions, references to condition and necessary permissions for use and occupation together with all other details are given in good faith and are believed to be correct.  However, any intending purchasers or tenants should not rely upon them as statements or representations of fact and must satisfy themselves by inspection or otherwise as to the correctness of each of them. (III) no person in the employment of Mason Young Ltd or any joint agents has any authority to make or give any representation or warranty whatsoever in relation to this property. (IV) reference to any gas, electrical or other fixtures, fittings, appliances or services have not been tested and no warranty is given or implied as to their availability, adequacy, condition or effectiveness. (V) unless otherwise stated all prices and rentals quoted are exclusive of any Value Added Tax to which they may be subject. (VI) Mason Young have not had the opportunity to inspect any title documentation and intending purchasers or tenants should verify the information through their legal advisor. (VII) information on Town & Country planning matters and Rating matters has been obtained by verbal enquiry only from the appropriate Local Authority.  Prospective purchasers are recommended to obtain written information thereof. (VIII) No environmental audit or investigation has been carried out on the property and no Environmental Report has been inspected.  We have not carried out an inspection for asbestos and no Asbestos Register has been viewed.  Potential purchasers/ tenants should satisfy themselves on the above matters through enquiries of their Surveyor/ Solicitor. (IX) Mason Young Property Consultants is the trading name of Mason Young Ltd.'

// Rateable Value to annual Rates Payable — the current UK non-domestic
// rating multiplier the firm uses for these brochures.
export const RATES_MULTIPLIER = 0.432

export function computeRatesPayable(rateableValue: string): string | null {
  const n = Number(rateableValue.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  const rates = n * RATES_MULTIPLIER
  return rates.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
}

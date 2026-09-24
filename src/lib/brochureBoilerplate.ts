import type { BrochureDisposalType } from '../components/PropertyBrochures/types'

// Pulled directly from the real exemplar brochures and the blank
// "New Brochure 2020" templates (FH / LH / LFS).
export const BROCHURE_HEADING: Record<BrochureDisposalType, string> = {
  freehold: 'FOR SALE',
  leasehold: 'TO LET',
  lease_assignment: 'LEASE FOR SALE',
}

export const BROCHURE_DISCLAIMER =
  'Property Misrepresentation Act:  Mason Young Property Consultants for themselves and for the vendors or lessors of this property, whose agents they are, give notice that: (I) these particulars are for guidance only and do not constitute any part of an offer or contract. (II) all descriptions, dimensions, references to condition and necessary permissions for use and occupation together with all other details are given in good faith and are believed to be correct.  However, any intending purchasers or tenants should not rely upon them as statements or representations of fact and must satisfy themselves by inspection or otherwise as to the correctness of each of them. (III) no person in the employment of Mason Young Ltd or any joint agents has any authority to make or give any representation or warranty whatsoever in relation to this property. (IV) reference to any gas, electrical or other fixtures, fittings, appliances or services have not been tested and no warranty is given or implied as to their availability, adequacy, condition or effectiveness. (V) unless otherwise stated all prices and rentals quoted are exclusive of any Value Added Tax to which they may be subject. (VI) Mason Young have not had the opportunity to inspect any title documentation and intending purchasers or tenants should verify the information through their legal advisor. (VII) information on Town & Country planning matters and Rating matters has been obtained by verbal enquiry only from the appropriate Local Authority.  Prospective purchasers are recommended to obtain written information thereof. (VIII) No environmental audit or investigation has been carried out on the property and no Environmental Report has been inspected.  We have not carried out an inspection for asbestos and no Asbestos Register has been viewed.  Potential purchasers/ tenants should satisfy themselves on the above matters through enquiries of their Surveyor/ Solicitor. (IX) Mason Young Property Consultants is the trading name of Mason Young Ltd.'

export const PLANNING_TEXT = 'Interested parties should contact Birmingham City Council Planning Department on 0121 303 1115.'

export const SERVICES_TEXT =
  'We are advised all main services are connected to include mains gas, water and electricity. Mason Young Property Consultants has not checked and does not accept responsibility for any of the services within this property and would suggest that any in-going tenant or occupier satisfies themselves in this regard.'

export const EPC_TEXT = 'Details available upon request.'

export const BUILDING_INSURANCE_TEXT = 'The annual building insurance for the property is payable in addition to the quoting rent.'

export const MONEY_LAUNDERING_TEXT =
  'The money laundering regulations require identification checks are undertaken for all parties purchasing/ leasing property.  Before a business relationship can be formed, we will request proof of identification for the purchasing/ leasing entity.'

export const VAT_TEXT = 'We understand that the property is not elected for VAT.'

export const LEGAL_COSTS_TEXT = 'Each party to be responsible for their own legal costs incurred during this transaction.'

export const VIEWING_TEXT = 'Strictly by prior appointment with sole agents, Mason Young Property Consultants.'

export const CONTACT_DETAILS_LINES = ['Arjamand Farooqui BSc (Hons)', 'Tel: 0121 285 3535', 'Mob: 07929 410 481', 'Email: af@masonyoung.co.uk']

// Rateable Value to annual Rates Payable — the current UK non-domestic
// rating multiplier the firm uses for these brochures.
export const RATES_MULTIPLIER = 0.432

export function computeRatesPayable(rateableValue: string): number | null {
  const n = Number(rateableValue.replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return n * RATES_MULTIPLIER
}

export function formatCurrency(n: number): string {
  return n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2 })
}

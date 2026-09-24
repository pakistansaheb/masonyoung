export type BrochureDisposalType = 'freehold' | 'leasehold' | 'lease_assignment'

export interface BrochureData {
  disposalType: BrochureDisposalType
  address: string
  postTown: string
  postcode: string
  // Short descriptor shown under the big FOR SALE / TO LET heading, e.g.
  // "MODERN INDUSTRIAL UNITS" — optional, matches the real templates.
  subtitle: string
  // Free text, e.g. "632 - 701 SQ FT (59 - 65 SQ M)" — kept as one field
  // since exemplars mix single figures and ranges.
  sqFtText: string
  bullets: string[]
  locationDescription: string
  propertyDescription: string
  // Rateable Value, read by the user off the attached RV document and
  // typed in here — Rates Payable is then computed as RV x 0.432.
  rateableValue: string
  // Free text for the availability table's price/rent column, e.g.
  // "£225,000" or "£23,000 per annum exclusive".
  priceOrRent: string
  floorPlanFile: File | null
  mainImage: File | null
  galleryImages: File[]
}

export const BLANK_BROCHURE: BrochureData = {
  disposalType: 'freehold',
  address: '',
  postTown: '',
  postcode: '',
  subtitle: '',
  sqFtText: '',
  bullets: [],
  locationDescription: '',
  propertyDescription: '',
  rateableValue: '',
  priceOrRent: '',
  floorPlanFile: null,
  mainImage: null,
  galleryImages: [],
}

export const BULLET_SUGGESTIONS: Record<BrochureDisposalType, string[]> = {
  freehold: ['SELF-CONTAINED', 'PROMINENT LOCATION', 'ON-SITE PARKING', 'FLEXIBLE ACCOMMODATION'],
  leasehold: ['SELF-CONTAINED', 'SECURE GATED ACCESS', 'ON-SITE CAR PARKING', 'FLEXIBLE TERMS'],
  lease_assignment: ['SELF-CONTAINED', 'ESTABLISHED TRADING LOCATION', 'FLEXIBLE TERMS', 'IMMEDIATE AVAILABILITY'],
}

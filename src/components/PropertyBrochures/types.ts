export type BrochureDisposalType = 'freehold' | 'leasehold' | 'lease_assignment'

export interface BrochureData {
  disposalType: BrochureDisposalType
  address: string
  // Short descriptor under the big FOR SALE / TO LET heading — the blank
  // templates just have placeholder text here ("TITLE" / "DESCRIPTION").
  subtitle: string
  bullets: string[]

  locationDescription: string
  propertyDescription: string

  // ACCOMMODATION table — one row per floor that has a value, plus TOTAL.
  groundFloorSqFt: string
  groundFloorSqM: string
  firstFloorSqFt: string
  firstFloorSqM: string
  secondFloorSqFt: string
  secondFloorSqM: string
  otherFloorSqFt: string
  otherFloorSqM: string
  totalSqFt: string
  totalSqM: string

  // TENURE/PRICE, TENURE/RENT or LEASE DETAILS, depending on disposalType.
  quotingPrice: string // freehold
  quotingRent: string // leasehold, or the passing rent for a lease assignment
  leaseTermYears: string // lease_assignment
  leaseStartDate: string // lease_assignment
  premium: string // lease_assignment — premium sought for fixtures & fittings

  // BUSINESS RATES — Rates Payable is computed as rateableValue x 0.432.
  ratingYear: string
  rateableValue: string

  // Text read off the attached floor plan/report — a floor plan drawing's
  // margin notes, or a full report PDF's text. Fed to the AI as the
  // property description's source material.
  floorPlanNotes: string
  floorPlanFile: File | null
  mainImage: File | null
  galleryImages: File[]
}

const currentRatingYear = String(new Date().getFullYear())

export const BLANK_BROCHURE: BrochureData = {
  disposalType: 'freehold',
  address: '',
  subtitle: '',
  bullets: [],
  locationDescription: '',
  propertyDescription: '',
  groundFloorSqFt: '',
  groundFloorSqM: '',
  firstFloorSqFt: '',
  firstFloorSqM: '',
  secondFloorSqFt: '',
  secondFloorSqM: '',
  otherFloorSqFt: '',
  otherFloorSqM: '',
  totalSqFt: '',
  totalSqM: '',
  quotingPrice: '',
  quotingRent: '',
  leaseTermYears: '',
  leaseStartDate: '',
  premium: '',
  ratingYear: currentRatingYear,
  rateableValue: '',
  floorPlanNotes: '',
  floorPlanFile: null,
  mainImage: null,
  galleryImages: [],
}

export const BULLET_SUGGESTIONS: Record<BrochureDisposalType, string[]> = {
  freehold: ['SELF-CONTAINED', 'PROMINENT LOCATION', 'ON-SITE PARKING', 'FLEXIBLE ACCOMMODATION'],
  leasehold: ['SELF-CONTAINED', 'SECURE GATED ACCESS', 'ON-SITE CAR PARKING', 'FLEXIBLE TERMS'],
  lease_assignment: ['SELF-CONTAINED', 'ESTABLISHED TRADING LOCATION', 'FLEXIBLE TERMS', 'IMMEDIATE AVAILABILITY'],
}

export type DisposalType = 'freehold' | 'leasehold' | 'long_leasehold' | 'lease_assignment'
export type FormLength = 'long' | 'short'

export interface ReportData {
  // Step 1
  disposalType: DisposalType
  formLength: FormLength

  // Step 2
  clientName: string // full name, e.g. "Graham Clough" — used in the recipient address block
  clientSalutation: string // e.g. "Dear James" or "Dear Mr Lacey"
  address: string // full multi-line address, as it should appear in the Re: line and letter address block
  postTown: string
  postcode: string

  // Step 3
  floorPlanNotes: string
  attachmentNames: string[]

  // Step 4 (AI-assisted, editable)
  locationDescription: string
  propertyDescription: string

  // Step 5 — commercial terms
  quotingPrice: string // freehold sale price, e.g. "225,000"
  targetPrice: string
  quotingRent: string // leasehold rent, e.g. "23,000"
  targetRent: string
  saleFeePercent: string
  lettingFeeFirstYearPercent: string
  managedService: boolean
  managedServiceLettingFeePercent: string
  managementFeePercent: string
  premium: string // for lease_assignment
  leaseExpiry: string // for lease_assignment / long_leasehold
  groundRent: string // for long_leasehold
  groundRentReviewYears: string

  tenureNotes: string
  servicesNotes: string
  conditionNotes: string

  groundFloorSqFt: string
  firstFloorSqFt: string
  otherFloorSqFt: string
  totalSqFt: string
  measurementBasis: 'net internal' | 'gross internal'
}

export const BLANK_REPORT: ReportData = {
  disposalType: 'freehold',
  formLength: 'long',
  clientName: '',
  clientSalutation: '',
  address: '',
  postTown: '',
  postcode: '',
  floorPlanNotes: '',
  attachmentNames: [],
  locationDescription: '',
  propertyDescription: '',
  quotingPrice: '',
  targetPrice: '',
  quotingRent: '',
  targetRent: '',
  saleFeePercent: '1.5',
  lettingFeeFirstYearPercent: '10',
  managedService: false,
  managedServiceLettingFeePercent: '7.5',
  managementFeePercent: '8',
  premium: '',
  leaseExpiry: '',
  groundRent: '',
  groundRentReviewYears: '7',
  tenureNotes: '',
  servicesNotes: 'mains gas, water and electricity',
  conditionNotes:
    'the condition of the building is reasonable for its age and use. No doubt any potential occupier will carry out their own investigation as to the condition and whether any remedial work is required for their own purposes',
  groundFloorSqFt: '',
  firstFloorSqFt: '',
  otherFloorSqFt: '',
  totalSqFt: '',
  measurementBasis: 'net internal',
}

export interface Hospital {
  id: string
  name: string
  location: { lat: number; lng: number }
  travelEtaMinutes: number
  waitMinutes: number
  rating?: number
  totalMinutes?: number
  comparisonMax?: number
}

import { NextResponse } from 'next/server'
import fs from 'node:fs/promises'
import path from 'node:path'

export async function GET(request: Request) {
  // Try to read lat/lng from query params and proxy to external API when provided.
  const url = new URL(request.url)
  const lat = url.searchParams.get('lat')
  const lng = url.searchParams.get('lng')
  const max = url.searchParams.get('max')

  try {
    if (lat && lng) {
      const body = {
        lat: Number(lat),
        lng: Number(lng),
        max_results: max ? Number(max) : 10,
      }

      const resp = await fetch(process.env.BACKEND_HOSPITALS_URL + '/nearby-hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        // Ensure no caching of dynamic location-based results
        cache: 'no-store',
      })

      if (!resp.ok) throw new Error(`Upstream error ${resp.status}`)
      const data = await resp.json().catch(() => ({ hospitals: [] }))
      const hospitals = Array.isArray(data?.hospitals) ? data.hospitals : []

      type Mapped = {
        id: string
        name: string
        travelEtaMinutes: number
        waitMinutes: number
        distanceKm?: number
        gmapsUrl?: string | null
        totalMinutes?: number
        comparisonMax?: number
      }
      const mapped: Mapped[] = hospitals.map((h: any): Mapped => {
        const travelEta = Number(h?.eta_minutes ?? 0)
        const wait = Number(h?.current_estimated_wait_minutes ?? 0)
        return {
          id: h?.hospital_id ?? '',
          name: h?.hospital_name ?? 'Unknown hospital',
          travelEtaMinutes: isNaN(travelEta) ? 0 : travelEta,
          waitMinutes: isNaN(wait) ? 0 : wait,
          distanceKm: Number(h?.distance_km ?? 0),
          gmapsUrl: h?.google_maps_location_link ?? null,
          // location is unknown from upstream response
        }
      })

      // compute total and sort
      const withTotals: Mapped[] = mapped.map((h: Mapped) => ({ ...h, totalMinutes: (h.travelEtaMinutes ?? 0) + (h.waitMinutes ?? 0) }))
      const maxTotal = withTotals.reduce((m: number, h: Mapped) => Math.max(m, h.totalMinutes ?? 0), 1)
      withTotals.forEach((h: Mapped) => (h.comparisonMax = maxTotal))
      withTotals.sort((a: Mapped, b: Mapped) => (a.totalMinutes ?? 0) - (b.totalMinutes ?? 0))
      return NextResponse.json({ hospitals: withTotals })
    }
  } catch (e) {
    // Swallow and fall back to mock data below
    console.error('[api/hospitals] upstream error, falling back to mock:', e)
  }

  // Fallback to static mock data when no coords provided or upstream fails
  const jsonPath = path.join(process.cwd(), 'public', 'mock', 'hospitals.json')
  const raw = await fs.readFile(jsonPath, 'utf-8').catch(() => '[]')
  const hospitals = JSON.parse(raw) as any[]
  const withTotals = hospitals.map(h => ({ ...h, totalMinutes: h.travelEtaMinutes + h.waitMinutes }))
  const maxTotal = withTotals.reduce((m, h) => Math.max(m, h.totalMinutes), 1)
  withTotals.forEach(h => (h.comparisonMax = maxTotal))
  withTotals.sort((a, b) => a.totalMinutes - b.totalMinutes)
  return NextResponse.json({ hospitals: withTotals })
}

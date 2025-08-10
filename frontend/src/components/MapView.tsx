"use client"

import { useEffect, useRef } from 'react'
import { MapPin, ChevronUp, ChevronDown, AlignCenter } from 'lucide-react'

export default function MapView({ userPosition, onToggleList, showList }: { userPosition: GeolocationPosition | null, onToggleList: () => void, showList: boolean }) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const userMarkerRef = useRef<any>(null)
  const hospitalMarkersRef = useRef<any[]>([])

  useEffect(() => {
    const hasKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!hasKey) return

    const init = async () => {
      const existing = document.querySelector<HTMLScriptElement>('#gmaps')
      if (!existing) {
        const script = document.createElement('script')
        script.id = 'gmaps'
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        document.body.appendChild(script)
        await new Promise(res => script.onload = () => res(null))
      }
      if (!mapRef.current) return
      // Create map once
      if (!mapInstanceRef.current) {
        // @ts-ignore
        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: userPosition ? { lat: userPosition.coords.latitude, lng: userPosition.coords.longitude } : { lat: 3.139, lng: 101.6869 },
          zoom: 11,
          disableDefaultUI: true,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          // Light styling that preserves terrain/satellite visibility
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            },
            {
              featureType: 'road',
              elementType: 'labels',
              stylers: [{ visibility: 'simplified' }]
            },
            // { elementType: 'geometry', stylers: [{ color: '#0b1020' }] },
            // { elementType: 'labels.text.fill', stylers: [{ color: '#ffffff' }] },
            // { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1020' }] },
          ],
        })
      }

      // Ensure user marker reflects latest location
      if (userPosition && mapInstanceRef.current) {
        const pos = { lat: userPosition.coords.latitude, lng: userPosition.coords.longitude }
        if (!userMarkerRef.current) {
          // @ts-ignore
          userMarkerRef.current = new google.maps.Marker({ position: pos, map: mapInstanceRef.current, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 6, fillColor: '#3b82f6', fillOpacity: 1, strokeWeight: 0 } })
        } else {
          userMarkerRef.current.setPosition(pos)
        }
        mapInstanceRef.current.setCenter(pos)
      }

      // Load or refresh hospital markers
      if (mapInstanceRef.current) {
        // Clear old markers
        hospitalMarkersRef.current.forEach(m => m.setMap(null))
        hospitalMarkersRef.current = []
        try {
          const qs = userPosition ? `?lat=${userPosition.coords.latitude}&lng=${userPosition.coords.longitude}&max=10` : ''
          const res = await fetch(`/api/hospitals${qs}`)
          const data = await res.json()
          data.hospitals.forEach((h: any) => {
            // External API may not provide coordinates; only place markers when we have them
            if (h?.location && typeof h.location.lat === 'number' && typeof h.location.lng === 'number') {
              // @ts-ignore
              const marker = new google.maps.Marker({ position: h.location, map: mapInstanceRef.current, title: h.name })
              hospitalMarkersRef.current.push(marker)
            }
          })
        } catch {}
      }

      // Fit bounds to show user and hospitals if both exist, but maintain reasonable zoom
      try {
        if (userMarkerRef.current && hospitalMarkersRef.current.length > 0) {
          // @ts-ignore
          const bounds = new google.maps.LatLngBounds()
          bounds.extend(userMarkerRef.current.getPosition())
          hospitalMarkersRef.current.forEach(m => bounds.extend(m.getPosition()))
          
          if (!bounds.isEmpty()) {
            mapInstanceRef.current.fitBounds(bounds)
            // Enforce minimum zoom to prevent excessive zoom-out
            const listener = mapInstanceRef.current.addListener('bounds_changed', () => {
              const z = mapInstanceRef.current.getZoom()
              // Keep zoom between 9 (wider view) and 14 (not too close)
              if (z < 9) mapInstanceRef.current.setZoom(9)
              else if (z > 14) mapInstanceRef.current.setZoom(14)
              // @ts-ignore
              google.maps.event.removeListener(listener)
            })
          }
        } else if (userMarkerRef.current) {
          // If we only have user position, center on user with reasonable zoom
          mapInstanceRef.current.setCenter(userMarkerRef.current.getPosition())
          mapInstanceRef.current.setZoom(11)
        }
      } catch {}
    }
    init()
  }, [userPosition])

  return (
    <div className="relative">
      <div 
        ref={mapRef} 
        className="h-64 bg-[url('https://maps.gstatic.com/tactile/basepage/pegman_sherlock.png')] bg-center bg-cover rounded-xl overflow-hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      />
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <div className="absolute inset-0 grid place-items-center text-center p-6 text-white/70 text-sm bg-gradient-to-b from-black/30 to-black/50">
          <div>
            <div className="mb-2 text-white">Map preview</div>
            <div>Set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable interactive map.</div>
          </div>
        </div>
      )}
      <button onClick={onToggleList} className="absolute right-3 bottom-3 rounded-full p-3 bg-black/60 border border-white/10">
        {showList ? <ChevronDown className="w-5 h-5"/> : <ChevronUp className="w-5 h-5"/>}
      </button>
      <div className="absolute left-3 bottom-3 rounded-full p-2 bg-brand-600 border border-white/10">
        <MapPin className="w-5 h-5"/>
      </div>
    </div>
  )
}

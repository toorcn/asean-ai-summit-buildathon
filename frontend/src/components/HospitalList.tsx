"use client"

import useSWR from 'swr'
import HospitalCard from './HospitalCard'
import { LoadingSkeleton } from './ui/LoadingSkeleton'
import { RecommendationBanner } from './RecommendationBanner'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ComparisonToggle, type Mode } from './filters/ComparisonToggle'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function HospitalList({ open, onOpenChange, userPosition }: { open: boolean, onOpenChange: (v: boolean) => void, userPosition: GeolocationPosition | null }) {
  const lat = userPosition?.coords.latitude
  const lng = userPosition?.coords.longitude
  const key = (lat != null && lng != null)
    ? `/api/hospitals?lat=${lat}&lng=${lng}&max=10`
    : '/api/hospitals'
  const { data, isLoading } = useSWR(key, fetcher)
  const [mode, setMode] = useState<Mode>('Fastest')
  const hospitalsRaw = data?.hospitals ?? []
  const hospitals = useMemo(() => {
    const list = [...hospitalsRaw]
    if (mode === 'Fastest') {
      list.sort((a: any, b: any) => a.totalMinutes - b.totalMinutes)
    } else if (mode === 'Closest') {
      list.sort((a: any, b: any) => a.travelEtaMinutes - b.travelEtaMinutes)
    } else if (mode === 'Best-rated') {
      list.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0))
    }
    return list
  }, [hospitalsRaw, mode])
  const recommended = hospitals[0]

  const containerRef = useRef<HTMLDivElement | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const collapsedPct = 82
  const [dragging, setDragging] = useState(false)
  const [dragTranslatePct, setDragTranslatePct] = useState<number | null>(null)
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

  useEffect(() => {
    // Reset drag translate when external state changes
    setDragTranslatePct(null)
  }, [open])

  const startYRef = useRef(0)
  const startTranslateRef = useRef(0)

  const velocityRef = useRef(0)
  const lastTimestampRef = useRef(0)
  const lastPositionRef = useRef(0)

  const onTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return
    setDragging(true)
    startYRef.current = e.touches[0].clientY
    startTranslateRef.current = open ? 0 : collapsedPct
    velocityRef.current = 0
    lastTimestampRef.current = Date.now()
    lastPositionRef.current = e.touches[0].clientY
    // Prevent scrolling on the body while dragging
    document.body.style.overflow = 'hidden'
  }
  
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !containerRef.current) return
    e.preventDefault() // Prevent default scrolling behavior
    
    const height = containerRef.current.getBoundingClientRect().height
    const deltaY = e.touches[0].clientY - startYRef.current
    const deltaPct = (deltaY / height) * 100
    const next = clamp(startTranslateRef.current + deltaPct, 0, collapsedPct)
    setDragTranslatePct(next)
    
    // Calculate velocity for momentum-based snapping
    const now = Date.now()
    const timeDelta = now - lastTimestampRef.current
    if (timeDelta > 0) {
      const positionDelta = e.touches[0].clientY - lastPositionRef.current
      velocityRef.current = positionDelta / timeDelta
      lastTimestampRef.current = now
      lastPositionRef.current = e.touches[0].clientY
    }
  }
  
  const onTouchEnd = () => {
    if (!dragging) return
    setDragging(false)
    document.body.style.overflow = '' // Restore scrolling
    
    const translate = dragTranslatePct == null ? (open ? 0 : collapsedPct) : dragTranslatePct
    const velocity = velocityRef.current
    
    // Enhanced snap logic with velocity consideration
    let shouldOpen = translate < collapsedPct / 2
    
    // If moving fast enough, respect the direction
    if (Math.abs(velocity) > 0.3) {
      if (velocity < -0.3) { // Fast upward swipe
        shouldOpen = true
      } else if (velocity > 0.3) { // Fast downward swipe
        shouldOpen = false
      }
    }
    
    onOpenChange(shouldOpen)
    setDragTranslatePct(null)
    velocityRef.current = 0
  }

  const translatePct = dragTranslatePct != null ? dragTranslatePct : (open ? 0 : collapsedPct)

  return (
    <div
      ref={containerRef}
      className={`fixed pb-12 left-0 right-0 bottom-0 max-w-xl mx-auto bg-black/70 backdrop-blur border-t border-white/10 rounded-t-2xl h-[85vh] overflow-hidden ${
        dragging ? '' : 'transition-transform duration-500 ease-out'
      }`}
      role="dialog" aria-modal="true"
      style={{ 
        transform: `translateY(${translatePct}%)`,
        willChange: dragging ? 'transform' : 'auto'
      }}
    >
      <div className="p-4 pt-3 h-full flex flex-col gap-3">
        <div
          ref={headerRef}
          className="pb-2 select-none cursor-grab active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={(e) => {
            // Convert mouse events to touch-like events for desktop support
            const touchEvent = {
              touches: [{ clientY: e.clientY }],
              preventDefault: () => e.preventDefault()
            } as any
            onTouchStart(touchEvent)
          }}
          onMouseMove={(e) => {
            if (!dragging) return
            const touchEvent = {
              touches: [{ clientY: e.clientY }],
              preventDefault: () => e.preventDefault()
            } as any
            onTouchMove(touchEvent)
          }}
          onMouseUp={() => {
            if (dragging) onTouchEnd()
          }}
          onMouseLeave={() => {
            if (dragging) onTouchEnd()
          }}
          style={{ touchAction: 'none' }}
        >
          <div className="h-1 w-10 bg-white/40 rounded-full mx-auto mb-2" />
          {!open && (
            <div className="text-center mb-3">
              <div className="text-xs text-brand-300 font-medium bg-brand-600/10 px-3 py-1.5 rounded-full border border-brand-600/20 inline-flex items-center gap-1">
                <span className="text-brand-400">↑</span>
                Swipe up for hospitals
              </div>
            </div>
          )}
          <div className={`${!open ? 'mt-1' : 'mt-2'} flex items-center justify-between`}>
            <div className="text-sm text-white/60">Hospitals near you</div>
            <div className="flex items-center gap-2">
              <ComparisonToggle value={mode} onChange={setMode} />
              <button onClick={() => onOpenChange(false)} className="text-white/60 text-sm">Close</button>
            </div>
          </div>
        </div>
        {isLoading && <LoadingSkeleton lines={3} />}
        {!isLoading && recommended && <RecommendationBanner hospital={recommended} />}
        <div 
          className="grid gap-3 overflow-y-auto pr-1" 
          style={{ 
            maxHeight: '55vh', 
            WebkitOverflowScrolling: 'touch' as any,
            pointerEvents: open ? 'auto' : 'none'
          }}
        >
          {hospitals.map((h: any, i: number) => (
            <HospitalCard key={h.id} hospital={h} rank={i+1} mode={mode} />
          ))}
        </div>
      </div>
    </div>
  )
}

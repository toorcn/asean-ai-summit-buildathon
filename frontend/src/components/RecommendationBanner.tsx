"use client"

import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'

export function RecommendationBanner({ hospital }: { hospital: any }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 400)
    return () => clearTimeout(t)
  }, [])
  return (
    <AnimatePresence>
      {show && (
        <div className="p-4 rounded-xl bg-emerald-600/15 border border-emerald-600/30 bubble-in">
          <div className="flex items-center gap-2 text-emerald-300">
            <Sparkles className="w-4 h-4"/>
            <span className="text-xs uppercase tracking-wide">Fastest — Recommended</span>
          </div>
          <div className="mt-1 text-sm">{hospital.name} saves you time. Total ~ {hospital.totalMinutes} minutes.</div>
          {/* <Confetti /> */}
        </div>
      )}
    </AnimatePresence>
  )
}

function Confetti() {
  return (
    <div className="pointer-events-none select-none">
      <svg className="w-full h-8" viewBox="0 0 200 40" aria-hidden>
        <g fill="none" stroke="currentColor" strokeOpacity="0.4">
          <path d="M10 10l5 10M30 5l-5 12M60 8l6 14M90 6l-6 12M120 9l8 10M150 7l-8 12M180 4l6 14" />
        </g>
      </svg>
    </div>
  )
}

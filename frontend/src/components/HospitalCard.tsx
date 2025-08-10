"use client"

import { useRouter } from 'next/navigation'
import { Clock, Navigation } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Mode } from './filters/ComparisonToggle'

export default function HospitalCard({ hospital, rank, mode }: { hospital: any, rank: number, mode: Mode }) {
  const router = useRouter()
  const total = hospital.totalMinutes as number
  const max = Math.max(1, hospital.comparisonMax ?? 60)
  const ratio = Math.min(1, total / max)
  const label = mode === 'Closest' ? 'Closest' : 'Fastest'
  const getGoogleMapsLink = (h: any) => {
    if (h?.gmapsUrl) return String(h.gmapsUrl)
    const lat = h?.location?.lat ?? h?.lat ?? h?.latitude
    const lng = h?.location?.lng ?? h?.lng ?? h?.longitude
    if (typeof lat === 'number' && typeof lng === 'number') {
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    }
    if (h?.name) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(String(h.name))}`
    }
    return 'https://www.google.com/maps'
  }
  const onGoClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = getGoogleMapsLink(hospital)
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4 active:scale-[.99]"
      onClick={() => router.push('/chat')}
    >
      <div className="relative shrink-0">
        <svg width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,.15)" strokeWidth="6" fill="none" />
          <motion.circle cx="28" cy="28" r="24" stroke="#3b82f6" strokeWidth="6" fill="none"
            strokeDasharray={2*Math.PI*24}
            strokeDashoffset={2*Math.PI*24*(1-ratio)}
            initial={{ strokeDashoffset: 2*Math.PI*24 }}
            animate={{ strokeDashoffset: 2*Math.PI*24*(1-ratio) }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            strokeLinecap="round"
          />
          <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="12" fontWeight={600}>{total}m</text>
        </svg>
        {rank === 1 && (
          <span className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600">{label}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium leading-snug line-clamp-2">{hospital.name}</div>
        <div className="text-xs text-white/60 flex items-center gap-2 flex-wrap mt-1.5">
          <span className="flex items-center gap-1"><Navigation className="w-3 h-3"/> {hospital.travelEtaMinutes}m travel</span>
          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {hospital.waitMinutes}m wait</span>
        </div>
      </div>
      <button
        className="px-3 py-2 rounded-md bg-brand-600 text-sm shrink-0"
        onClick={onGoClick}
        aria-label="Open directions in Google Maps"
      >
        Go
      </button>
    </div>
  )
}

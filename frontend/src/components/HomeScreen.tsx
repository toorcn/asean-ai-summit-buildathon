"use client"

import { useEffect, useState } from 'react'
import HospitalList from './HospitalList'
import MapView from './MapView'
import { ErrorBanner } from './ui/ErrorBanner'

export default function  HomeScreen() {
  const [permission, setPermission] = useState<'prompt'|'granted'|'denied'>('prompt')
  const [position, setPosition] = useState<GeolocationPosition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Location not supported')
      return
    }
    navigator.permissions?.query({ name: 'geolocation' as PermissionName }).then(res => {
      setPermission(res.state as any)
      res.onchange = () => setPermission((res.state as any))
    }).catch(() => {})
  }, [])

  const requestLocation = () => {
    setError(null)
    if (!('geolocation' in navigator)) {
      setError('Location not supported on this device/browser')
  // Let user continue with generic hospitals list
  setShowList(true)
      return
    }
    // Geolocation requires a secure context (HTTPS or localhost)
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    if (!window.isSecureContext && !isLocalhost) {
  setError('Location requires HTTPS. Please use https or run on localhost.')
  // Allow browsing hospitals without precise location
  setShowList(true)
      return
    }

    setIsLocating(true)

    let resolved = false
    let watchId: number | null = null
    let watchdogTimer: number | null = null
    const clearAll = () => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId) } catch {}
      }
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer)
        watchdogTimer = null
      }
      setIsLocating(false)
    }

    const onSuccess = (pos: GeolocationPosition) => {
      if (resolved) return
      resolved = true
      clearAll()
      setPosition(pos)
      setPermission('granted')
      setShowList(true)
      try { navigator.vibrate?.(20) } catch {}
    }
    const onError = (err: GeolocationPositionError | any) => {
      if (resolved) return
      resolved = true
      clearAll()
      if (typeof err?.code === 'number' && err.code === 1) {
        setPermission('denied')
      }
      const message = typeof err?.message === 'string' ? err.message : 'Unable to get your location.'
      setError(message)
      // Let user proceed with hospitals list without geolocation
      setShowList(true)
    }

    // Primary: one-shot current position
    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        // Use a quicker initial fix; improves reliability on some devices
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 30000,
      })
    } catch (e: any) {
      onError(e)
      return
    }

    // Fallback: start a short-lived watchPosition if the one-shot is slow
    // This improves reliability on some iOS/Safari versions where the first call stalls
    const fallbackTimer = window.setTimeout(() => {
      if (resolved) return
      try {
        watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
          enableHighAccuracy: false,
          maximumAge: 30000,
        })
        // Auto-stop watch after 20s if still unresolved
        window.setTimeout(() => {
          if (!resolved && watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId) } catch {}
          }
        }, 20000)
      } catch (e: any) {
        onError(e)
      }
    }, 3000)

    // Global watchdog: ensure we never hang indefinitely (Safari quirks)
    watchdogTimer = window.setTimeout(() => {
      if (resolved) return
      onError({ message: 'Location request timed out. Showing hospitals without your location.' })
    }, 15000)
  }

  return (
    <div className="p-4 space-y-4">
      <section className="text-center space-y-3">
        <h1 className="text-xl font-semibold">Find the fastest hospital</h1>
        <p className="text-white/60 text-sm">We combine travel time and estimated wait to recommend where you’ll be seen the fastest.</p>
        <button
          onClick={requestLocation}
          disabled={isLocating}
          aria-busy={isLocating}
          className={`mt-2 px-6 py-4 rounded-xl w-full text-white font-medium transition-all duration-300 transform ${
            isLocating 
              ? 'bg-brand-600/60 cursor-not-allowed scale-95' 
              : 'bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-500 hover:to-brand-600 hover:scale-105 hover:shadow-xl hover:shadow-brand-600/30 active:scale-95'
          } ${!isLocating ? 'animate-float' : ''}`}
        >
          <div className="flex items-center justify-center gap-2">
            {isLocating && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            )}
            <span>
              {isLocating
                ? 'Getting your location...'
                : permission === 'granted'
                  ? 'Find Hospitals'
                  : 'Allow Location & Find Hospitals'}
            </span>
          </div>
        </button>
      </section>

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}

      <div 
        className="rounded-xl overflow-hidden border border-white/10 bg-white/5"
        style={{ 
          touchAction: showList ? 'pan-x pan-y' : 'auto',
          pointerEvents: showList ? 'auto' : 'auto'
        }}
      >
        <MapView userPosition={position} onToggleList={() => setShowList(s => !s)} showList={showList} />
      </div>

      {/* Information Section */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-emerald-300">Real-time</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">Live wait times from hospitals in your area</p>
          </div>
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/10 rounded-xl p-4 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-brand-400 rounded-full"></div>
              <span className="text-xs font-medium text-brand-300">AI Powered</span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">Smart routing based on symptoms and urgency</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-brand-600/20 to-purple-600/20 backdrop-blur border border-brand-500/30 rounded-xl p-4">
          <h3 className="font-medium text-white mb-2">How CARe Works</h3>
          <div className="space-y-2 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full"></div>
              <span>Find the fastest hospital based on travel + wait time</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full"></div>
              <span>Complete AI-powered intake before arrival</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-brand-400 rounded-full"></div>
              <span>Share summary via QR code to reception</span>
            </div>
          </div>
        </div>

        {position && (
          <div className="bg-gradient-to-r from-white/10 to-white/5 backdrop-blur border border-white/10 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-green-300">Location Found</span>
            </div>
            <p className="text-sm text-white/80">
              Latitude: {position.coords.latitude.toFixed(4)}, 
              Longitude: {position.coords.longitude.toFixed(4)}
            </p>
            <p className="text-xs text-white/60 mt-1">
              Accuracy: ±{Math.round(position.coords.accuracy)}m
            </p>
          </div>
        )}
      </div>

      <HospitalList open={showList} onOpenChange={setShowList} userPosition={position} />
    </div>
  )
}

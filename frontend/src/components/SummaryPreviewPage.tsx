"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { QRModal } from './qr/QRModal'
import { FileText, Clock, Calendar, Download, Share2, ChevronRight, Eye, Link as LinkIcon, MessageSquare, Hospital, ArrowRight } from 'lucide-react'

export default function SummaryPreviewPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [readingTime, setReadingTime] = useState<number>(45)
  const [showQR, setShowQR] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [latestDate, setLatestDate] = useState<string | null>(null)
  const [history, setHistory] = useState<Array<{ id: string; createdAt: number; summary: string; highlights: string[] }>>([])
  const [mounted, setMounted] = useState(false)
  const [hostedPdfUrl, setHostedPdfUrl] = useState<string | null>(null)
  const [hasRealData, setHasRealData] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const existing = typeof window !== 'undefined' ? localStorage.getItem('qc_session') : null
    if (existing) setSessionToken(existing)
    
    const run = async () => {
      try {
        const res = await fetch('/api/summary', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ sessionToken: existing || undefined }) 
        })
        const data = await res.json()
        
        // Check if this is real data or fallback data
        const isFallbackData = !existing || 
          data.summary === 'Patient summary unavailable. Please review intake fields.' ||
          (data.highlights && data.highlights.includes('Intake captured via chatbot'))
        
        setHasRealData(!isFallbackData)
        
        // Always set PDF URL if available, even for fallback data (for testing purposes)
        if (data.pdfUrl) {
          setPdfUrl(data.pdfUrl)
          let abs = data.pdfUrl
          // Ensure absolute URL for production
          if (!abs.startsWith('http')) {
            abs = `${window.location.origin}${data.pdfUrl}`
          }
          setHostedPdfUrl(abs)
        }
        
        if (!isFallbackData) {
          setHighlights(data.highlights)
          setReadingTime(data.readTimeSec)
          if (data.latestCreatedAt) setLatestDate(new Date(data.latestCreatedAt).toLocaleString())
          if (Array.isArray(data.history)) setHistory(data.history)
        } else {
          // For fallback data, still show some content for testing
          setHighlights(data.highlights || [])
          setReadingTime(data.readTimeSec || 45)
          if (data.latestCreatedAt) setLatestDate(new Date(data.latestCreatedAt).toLocaleString())
        }
      } catch (error) {
        console.error('Failed to fetch summary:', error)
        setHasRealData(false)
      } finally {
        setIsLoading(false)
      }
    }
    run()
  }, [])

  const fadeInUp = mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
  const staggerDelay = (index: number) => mounted ? "" : `delay-${Math.min(index * 100, 500)}`

  // Truncate long URLs for display
  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url
    const start = url.substring(0, 20)
    const end = url.substring(url.length - 20)
    return `${start}...${end}`
  }

  // Show empty state when there's no real data AND no PDF URL available
  if (!isLoading && !hasRealData && !pdfUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black" style={{ paddingBottom: 'var(--app-nav-h, 56px)' }}>
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 via-purple-600/20 to-brand-400/20 animate-pulse"></div>
          <div className={`relative p-6 transition-all duration-1000 ease-out ${fadeInUp}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-brand-600/20 border border-brand-500/30">
                <FileText className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Medical Summary
                </h1>
                <p className="text-sm text-brand-300">AI-generated patient intake report</p>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="px-6 pb-8 flex flex-col items-center justify-center min-h-[60vh]">
          <div className={`text-center space-y-6 transition-all duration-1000 ease-out delay-200 ${fadeInUp}`}>
            {/* Empty state illustration */}
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/20 flex items-center justify-center">
              <FileText className="w-12 h-12 text-white/50" />
            </div>
            
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">No Medical Summary Yet</h2>
              <p className="text-white/60 max-w-sm mx-auto leading-relaxed">
                Start by finding your nearest hospital or begin a chat session to create your AI-powered medical summary.
              </p>
            </div>

            {/* Action Cards */}
            <div className="space-y-4 w-full max-w-sm mx-auto mt-8">
              <Link href="/" className="group block">
                <div className="bg-gradient-to-r from-brand-600/20 to-brand-700/20 backdrop-blur border border-brand-500/30 rounded-xl p-4 hover:from-brand-600/30 hover:to-brand-700/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-brand-600/30">
                      <Hospital className="w-6 h-6 text-brand-300" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-white group-hover:text-brand-200 transition-colors">
                        Find Hospitals
                      </h3>
                      <p className="text-sm text-brand-200">
                        Locate nearby hospitals and compare options
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-brand-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>

              <Link href="/chat" className="group block">
                <div className="bg-gradient-to-r from-purple-600/20 to-purple-700/20 backdrop-blur border border-purple-500/30 rounded-xl p-4 hover:from-purple-600/30 hover:to-purple-700/30 transition-all duration-300 hover:scale-105">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-600/30">
                      <MessageSquare className="w-6 h-6 text-purple-300" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-white group-hover:text-purple-200 transition-colors">
                        Start AI Chat
                      </h3>
                      <p className="text-sm text-purple-200">
                        Begin your medical intake conversation
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-purple-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            </div>

            <div className="pt-6">
              <p className="text-xs text-white/40">
                Your medical summary will appear here once you complete an intake session
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black" style={{ paddingBottom: 'var(--app-nav-h, 56px)' }}>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 via-purple-600/20 to-brand-400/20 animate-pulse"></div>
          <div className="relative p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-brand-600/20 border border-brand-500/30">
                <FileText className="w-6 h-6 text-brand-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Medical Summary
                </h1>
                <p className="text-sm text-brand-300">Loading...</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-4 space-y-6">
          <div className="h-48 rounded-xl bg-gradient-to-br from-white/10 to-white/5 animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black" style={{ paddingBottom: 'var(--app-nav-h, 56px)' }}>
      {/* Header with animated gradient */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-600/20 via-purple-600/20 to-brand-400/20 animate-pulse"></div>
        <div className={`relative p-6 transition-all duration-1000 ease-out ${fadeInUp}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-brand-600/20 border border-brand-500/30">
              <FileText className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Medical Summary
              </h1>
              <p className="text-sm text-brand-300">AI-generated patient intake report</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-6">
        {/* Stats Cards */}
        <div className={`grid grid-cols-2 gap-4 transition-all duration-1000 ease-out delay-200 ${fadeInUp}`}>
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/20 rounded-xl p-4 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center gap-2 text-brand-300">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-medium">Reading Time</span>
            </div>
            <div className="text-2xl font-bold text-white mt-1">{readingTime}s</div>
          </div>
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur border border-white/20 rounded-xl p-4 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center gap-2 text-emerald-300">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-medium">Generated</span>
            </div>
            <div className="text-sm font-bold text-white mt-1">
              {latestDate ? new Date(latestDate).toLocaleDateString() : 'Today'}
            </div>
          </div>
        </div>

        {/* Key Highlights */}
        {highlights.length > 0 && (
          <div className={`transition-all duration-1000 ease-out delay-300 ${fadeInUp}`}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-brand-500 rounded-full"></div>
              Key Highlights
            </h2>
            <div className="space-y-3">
              {highlights.map((highlight, i) => (
                <div 
                  key={i} 
                  className={`bg-gradient-to-r from-white/10 to-white/5 backdrop-blur border border-white/10 rounded-lg p-4 hover:border-brand-500/50 transition-all duration-300 ${staggerDelay(i)}`}
                  style={{ animationDelay: `${400 + i * 100}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-brand-400 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-white/90 text-sm leading-relaxed">{highlight}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PDF Viewer */}
        <div className={`transition-all duration-1000 ease-out delay-500 ${fadeInUp}`}>
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            Full Report
          </h2>
          {hostedPdfUrl ? (
            <div className="rounded-xl overflow-hidden border border-white/20 bg-white/5 backdrop-blur">
              <div className="h-[50vh] relative group">
                <iframe src={hostedPdfUrl} className="w-full h-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
            </div>
          ) : (
            <div className="h-48 rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/10 to-white/5 animate-pulse"></div>
          )}
        </div>

        {/* Hosted PDF Link */}
        {hostedPdfUrl && (
          <div className={`transition-all duration-1000 ease-out delay-600 ${fadeInUp}`}>
            <div className="bg-gradient-to-r from-brand-600/20 to-purple-600/20 backdrop-blur border border-brand-500/30 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-600/30">
                  <LinkIcon className="w-5 h-5 text-brand-300" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Shareable Link</h3>
                  <p className="text-xs text-brand-200">Direct access to your medical summary</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigator.clipboard.writeText(hostedPdfUrl)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs rounded-lg transition-colors duration-200"
                    title="Copy full URL"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="mt-3 p-2 bg-black/30 rounded-lg group cursor-pointer" title={hostedPdfUrl}>
                <code className="text-xs text-brand-200 break-all group-hover:text-brand-100 transition-colors duration-200">{truncateUrl(hostedPdfUrl)}</code>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={`flex gap-3 transition-all duration-1000 ease-out delay-700 ${fadeInUp}`}>
          <a 
            href={pdfUrl ?? '#'} 
            download 
            className="flex-1 group bg-gradient-to-r from-white/20 to-white/10 backdrop-blur border border-white/20 rounded-xl p-4 hover:from-white/30 hover:to-white/20 transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center justify-center gap-2">
              <Download className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-200" />
              <span className="font-medium text-white">Download PDF</span>
            </div>
          </a>
          <button 
            onClick={() => setShowQR(true)}
            className="flex-1 group bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl p-4 hover:from-brand-500 hover:to-brand-600 transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center justify-center gap-2">
              <Share2 className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-200" />
              <span className="font-medium text-white">Show QR</span>
            </div>
          </button>
        </div>

        {/* History Section */}
        {history.length > 0 && (
          <div className={`transition-all duration-1000 ease-out delay-800 ${fadeInUp}`}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              Previous Summaries
            </h2>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {history.map((item, i) => (
                <div 
                  key={item.id} 
                  className="bg-gradient-to-r from-white/5 to-white/5 backdrop-blur border border-white/10 rounded-lg p-4 hover:border-white/20 transition-all duration-300 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/60">{new Date(item.createdAt).toLocaleDateString()}</span>
                    <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white/60 transition-colors duration-200" />
                  </div>
                  <p className="text-sm text-white/80 line-clamp-2">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <QRModal open={showQR} onOpenChange={setShowQR} sessionToken={sessionToken ?? undefined} pdfUrl={pdfUrl ?? undefined} />
    </div>
  )
}

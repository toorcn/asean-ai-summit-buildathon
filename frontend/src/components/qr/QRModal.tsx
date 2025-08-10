"use client"

import { useEffect, useState } from 'react'
import Image from 'next/image'
import QRCode from 'qrcode.react'

export function QRModal({ open, onOpenChange, sessionToken, pdfUrl }: { open: boolean, onOpenChange: (v: boolean) => void, sessionToken?: string, pdfUrl?: string }) {
  const [url, setUrl] = useState<string>('')
  const [expiresAt, setExpiresAt] = useState<string>('')
  
  useEffect(() => {
    if (!open) return
    
    const run = async () => {
      // Use the provided PDF URL if available, otherwise fall back to share-to-hospital
      if (pdfUrl) {
        const absoluteUrl = pdfUrl.startsWith('http') ? pdfUrl : `${window.location.origin}${pdfUrl}`
        setUrl(absoluteUrl)
        setExpiresAt(new Date(Date.now() + 10 * 60 * 1000).toISOString())
        return
      }
      
      // Fallback to legacy share-to-hospital endpoint
      const res = await fetch('/api/share-to-hospital', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionToken }) })
      const data = await res.json()
      setUrl(data.url)
      setExpiresAt(data.expiresAt)
    }
    run()
  }, [open, sessionToken, pdfUrl])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur z-50 grid place-items-center p-6" role="dialog" aria-modal>
      <div className="w-full max-w-sm bg-black/60 border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Image src="/CARe-logo.png" alt="CARe" width={90} height={22} className="h-5 w-auto" />
          <div className="text-sm text-white/60">Share PDF Report</div>
        </div>
        <div className="bg-white p-3 rounded-md grid place-items-center">
          {url && <QRCode value={url} size={200} />}
        </div>
        <div className="text-xs text-white/60">
          {pdfUrl ? 'Direct PDF access' : `Link expires: ${expiresAt}`}
        </div>
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 rounded-md bg-white/10" onClick={() => navigator.clipboard.writeText(url)}>Copy link</button>
          <button className="flex-1 px-3 py-2 rounded-md bg-brand-600" onClick={() => onOpenChange(false)}>Close</button>
        </div>
      </div>
    </div>
  )
}

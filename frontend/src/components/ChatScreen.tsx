"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Send, Volume2, VolumeX } from 'lucide-react'
import { MessageBubble } from './MessageBubble'
import { ErrorBanner } from './ui/ErrorBanner'
import { SummaryModal } from './SummaryModal'
import { VoiceHint } from './VoiceHint'
import { speak, stopTts } from '@/lib/tts'

interface ChatMessage { id: string; role: 'user'|'assistant'; content: string }

const initialBot = { id: 'init', role: 'assistant', content: 'Hi! I\`ll help collect a few details before you arrive. To begin, what brings you to the hospital today?' } as ChatMessage

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([initialBot])
  const [input, setInput] = useState('')
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const v = localStorage.getItem('qc_tts')
    return v === null ? true : v === '1'
  })
  const recognitionRef = useRef<any>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const lastSpokenId = useRef<string | null>(null)

  // Safe UUID generator for browsers that may not support crypto.randomUUID
  const getUUID = () => {
    const c: any = (typeof globalThis !== 'undefined' && (globalThis as any).crypto) || undefined
    if (c?.randomUUID) return c.randomUUID()
    if (c?.getRandomValues) {
      const rnds = c.getRandomValues(new Uint8Array(16))
      rnds[6] = (rnds[6] & 0x0f) | 0x40
      rnds[8] = (rnds[8] & 0x3f) | 0x80
      const toHex = (n: number) => n.toString(16).padStart(2, '0')
      const hex = Array.from(rnds, toHex).join('')
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
  }

  useEffect(() => { listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Create or restore a session so the receptionist can access progress in real-time
  useEffect(() => {
    const existing = typeof window !== 'undefined' ? localStorage.getItem('qc_session') : null
    if (existing) {
      setSessionToken(existing)
      return
    }
    const create = async () => {
      try {
        const res = await fetch('/api/sessions', { method: 'POST' })
        const data = await res.json()
        setSessionToken(data.token)
        localStorage.setItem('qc_session', data.token)
      } catch {}
    }
    create()
  }, [])

  const startVoice = () => {
    try {
      const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      if (!SR) throw new Error('Voice not supported on this browser')
      const rec = new SR()
      recognitionRef.current = rec
      rec.lang = 'en-US'
      rec.interimResults = true
      setRecording(true)
      rec.onresult = (e: any) => {
        let text = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript
        }
        setInput(text)
      }
      rec.onend = () => setRecording(false)
      rec.start()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const stopVoice = () => {
    recognitionRef.current?.stop?.()
  }

  // Auto-speak the latest assistant message when enabled
  useEffect(() => {
    const last = [...messages].reverse().find(m => m.role === 'assistant' && m.content !== '...')
    if (!last) return
    if (!ttsEnabled) return
    if (lastSpokenId.current === last.id) return
  // Stop any previous speech when moving to a new message
  stopTts()
    // Fire and forget; ignore playback errors (e.g., user gesture not yet granted)
    speak(last.content).catch(() => {})
    lastSpokenId.current = last.id
  }, [messages, ttsEnabled])

  const toggleTts = () => {
    setTtsEnabled(v => {
      const nv = !v
      if (typeof window !== 'undefined') localStorage.setItem('qc_tts', nv ? '1' : '0')
      return nv
    })
  }

  const send = async (overrideText?: string) => {
  // User is moving to the next question; stop any ongoing speech
  stopTts()
    const text = (overrideText ?? input).trim()
    if (!text) return
    if (navigator.vibrate) navigator.vibrate(10)
    const user: ChatMessage = { id: getUUID(), role: 'user', content: text }
    setMessages(m => [...m, user])
    setInput('')
    // typing indicator
    setMessages(m => [...m, { id: 'typing-' + Math.random(), role: 'assistant', content: '...', } as ChatMessage])
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history: [...messages, user].filter(x => x.content !== '...'), sessionToken }) })
      const data = await res.json()
      if (data.sessionToken && data.sessionToken !== sessionToken) {
        setSessionToken(data.sessionToken)
        if (typeof window !== 'undefined') localStorage.setItem('qc_session', data.sessionToken)
      }
      setMessages(m => [...m.filter(x => x.content !== '...'), ...data.replies])
      const done = data.replies.some((r: any) => String(r.content).includes('prepared your summary'))
      if (done) setShowSummary(true)
    } catch (e: any) {
      setError(e.message)
      setMessages(m => m.filter(x => x.content !== '...'))
    }
  }

  // Stop TTS when tab is hidden or component unmounts
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stopTts()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      stopTts()
    }
  }, [])

  // Adjust for mobile keyboards: use 100dvh and visualViewport to offset the input bar
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [bottomInset, setBottomInset] = useState(0)
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined
    if (!vv) return
    const onResize = () => {
      // When keyboard opens, visualViewport.height shrinks and offsetTop moves
      const offset = Math.max(0, (window.innerHeight - vv.height - vv.offsetTop))
      setBottomInset(offset)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => {
      vv.removeEventListener('resize', onResize)
      vv.removeEventListener('scroll', onResize)
    }
  }, [])

  // Quick replies based on the latest assistant question
  const latestAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].content !== '...') return messages[i].content.toLowerCase()
    }
    return ''
  }, [messages])

  // Only enable quick replies after the user has provided at least one message
  const hasUserMessage = useMemo(() => messages.some(m => m.role === 'user'), [messages])

  const quickReplies = useMemo(() => {
    // Prevent showing quick replies for the very first assistant question
    if (!hasUserMessage) return []
    const replies: string[] = []
    const c = latestAssistant
    if (!c) return replies
    // Pain scale 1-10
    if ((c.includes('pain') && (c.includes('1-10') || c.includes('1 to 10') || c.includes('scale'))) || c.includes('rate your pain')) {
      return Array.from({ length: 10 }, (_, i) => String(i + 1))
    }
    // Yes/No style prompts
    const yesNoTriggers = ['have you', 'are you', 'do you', 'did you', 'any recent travel', 'recent travel', 'exposure', 'medications?']
    if (yesNoTriggers.some(t => c.includes(t))) {
      return ['Yes', 'No']
    }
    return replies
  }, [latestAssistant, hasUserMessage])

  const onQuickReply = (value: string) => {
    send(value)
  }

  return (
    <div ref={containerRef} className="flex flex-col h-[100dvh]" style={{ paddingBottom: `calc(${bottomInset}px + var(--app-nav-h, 56px))` }}>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ paddingBottom: '120px' }}>
        {messages.map(m => (
          <MessageBubble key={m.id} role={m.role} content={m.content} />
        ))}
      </div>
      {quickReplies.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {quickReplies.map(q => (
              <button key={q} onClick={() => onQuickReply(q)} className="px-3 py-2 rounded-full bg-white/10 text-sm hover:bg-white/15 active:scale-[.98]">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <div className="px-4"><ErrorBanner message={error} onRetry={() => setError(null)} /></div>}
      <div className="p-3 border-t border-white/10 bg-black/60 backdrop-blur fixed bottom-0 left-0 right-0 z-30" style={{ bottom: 'var(--app-nav-h, 56px)' }}>
        <div className="flex items-center gap-2 max-w-xl mx-auto">
          <button
            onClick={toggleTts}
            className={`p-3 rounded-full transition-all duration-200 bg-white/10 hover:bg-white/15`}
            aria-label={ttsEnabled ? 'Disable speech' : 'Enable speech'}
            title={ttsEnabled ? 'Disable speech' : 'Enable speech'}
          >
            {ttsEnabled ? <Volume2 className="w-5 h-5 text-white"/> : <VolumeX className="w-5 h-5 text-white/70"/>}
          </button>
          <button 
            onClick={recording ? stopVoice : startVoice} 
            className={`p-3 rounded-full transition-all duration-200 ${
              recording 
                ? 'bg-red-600 hover:bg-red-700 scale-110 animate-pulse' 
                : 'bg-brand-600 hover:bg-brand-700 hover:scale-105'
            }`} 
            aria-label="Voice input"
          >
            <Mic className={`w-5 h-5 transition-transform duration-200 ${recording ? 'scale-110' : ''}`}/>
          </button>
          <div className="flex-1 relative">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && send()}
              placeholder="Type your message..." 
              className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 rounded-xl px-4 py-3 outline-none border border-white/10 focus:border-brand-500/50 transition-all duration-200 text-white placeholder-white/50" 
            />
            {input && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-pulse"></div>
              </div>
            )}
          </div>
          <button 
            onClick={() => send()} 
            disabled={!input.trim()}
            className={`p-3 rounded-full transition-all duration-200 ${
              input.trim() 
                ? 'bg-brand-600 hover:bg-brand-700 hover:scale-105' 
                : 'bg-white/10 cursor-not-allowed'
            }`} 
            aria-label="Send"
          >
            <Send className={`w-5 h-5 transition-transform duration-200 ${input.trim() ? 'text-white' : 'text-white/50'}`}/>
          </button>
        </div>
      </div>
      {/* <div className="px-4 pb-3"><VoiceHint /></div> */}
      <SummaryModal open={showSummary} onOpenChange={setShowSummary} sessionToken={sessionToken ?? undefined} />
    </div>
  )
}

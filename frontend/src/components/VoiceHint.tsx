"use client"

export function VoiceHint() {
  const supported = typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)
  if (!supported) return null
  return (
    <div className="text-[11px] text-white/50">Tip: Use the mic for faster input. You can edit transcribed text before sending.</div>
  )
}

let currentAudio: HTMLAudioElement | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null

export function stopTts() {
  try {
    if (currentAudio) {
      currentAudio.pause()
      // Release media element; avoids continuing to buffer
      try { currentAudio.src = '' } catch {}
      currentAudio = null
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      currentUtterance = null
    }
  } catch {}
}

export async function speak(text: string, opts?: { voice?: string; format?: 'mp3'|'wav'|'ogg'|'flac'|'mulaw'; speed?: number }) {
  if (!text?.trim()) return
  try {
    // Stop any previous playback before starting new
    stopTts()
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: opts?.voice, format: opts?.format, speed: opts?.speed })
    })
    if (!res.ok) throw new Error('TTS failed')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    try {
      const audio = new Audio(url)
      currentAudio = audio
      // Cleanup handlers
      const clear = () => { currentAudio = null }
      audio.addEventListener('ended', clear, { once: true })
      audio.addEventListener('error', clear, { once: true })
      await audio.play()
      return
    } finally {
      // Revoke shortly after to free memory; browser caches audio once playing
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
  } catch (err) {
    // Fallback to browser speech synthesis if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        // Stop ongoing first
        try { window.speechSynthesis.cancel() } catch {}
        const utter = new SpeechSynthesisUtterance(text)
        // Map a couple of common voice names if available
        const desired = (opts?.voice || '').toLowerCase()
        const voices = window.speechSynthesis.getVoices?.() || []
        if (voices.length && desired) {
          const match = voices.find(v => v.name.toLowerCase().includes(desired.replace('-playai', '').trim()))
          if (match) utter.voice = match
        }
        if (opts?.speed && typeof opts.speed === 'number') utter.rate = Math.max(0.5, Math.min(2, opts.speed))
        currentUtterance = utter
        const clear = () => { currentUtterance = null }
        utter.onend = clear
        utter.onerror = clear
        window.speechSynthesis.speak(utter)
        return
      } catch {}
    }
    // As a last resort, rethrow
    throw err
  }
}

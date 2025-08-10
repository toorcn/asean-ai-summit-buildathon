import { NextRequest, NextResponse } from 'next/server'

// Using Groq's OpenAI-compatible HTTP endpoint for TTS to avoid SDK gaps
const GROQ_API_URL = 'https://api.groq.com/openai/v1/audio/speech'

export const dynamic = 'force-dynamic'

function getEnv<T = string>(key: string, fallback?: T): T | undefined {
  const v = process.env[key]
  return (v as any) ?? fallback
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text: string = (body?.text ?? body?.input ?? '').toString()
  if (!text || text.length < 1) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  }
  if (text.length > 10_000) {
    return NextResponse.json({ error: 'Text too long (max 10k characters)' }, { status: 400 })
  }

  const model = (body?.model as string) || getEnv('GROQ_TTS_MODEL', 'playai-tts') as string
  const voice = (body?.voice as string) || getEnv('GROQ_TTS_VOICE', 'Fritz-PlayAI') as string
  const format = (body?.format as string) || (getEnv('GROQ_TTS_FORMAT', 'mp3') as string)
  const speed = typeof body?.speed === 'number' ? body.speed : undefined

  try {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        response_format: format,
        ...(speed ? { speed } : {}),
      }),
    })

    if (!res.ok) {
      const status = res.status
      const errText = await res.text().catch(() => '')
      return NextResponse.json({ error: 'Groq TTS failed', status, details: errText }, { status: 502, headers: { 'x-groq-status': String(status) } })
    }

    const buf = Buffer.from(await res.arrayBuffer())
    const contentType = format === 'wav' ? 'audio/wav' : format === 'ogg' ? 'audio/ogg' : format === 'flac' ? 'audio/flac' : format === 'mulaw' ? 'audio/basic' : 'audio/mpeg'
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'TTS request error', message: e?.message || String(e) }, { status: 500 })
  }
}

// Convenience GET for simple browser/curl testing: /api/tts?text=hello[&voice=Fritz-PlayAI&format=mp3]
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const text = url.searchParams.get('text') || url.searchParams.get('q') || ''
  const voice = url.searchParams.get('voice') || undefined
  const format = (url.searchParams.get('format') as any) || undefined
  const speed = url.searchParams.get('speed') ? Number(url.searchParams.get('speed')) : undefined
  if (!text.trim()) return NextResponse.json({ error: 'Missing text' }, { status: 400 })
  return POST(new NextRequest(req.url, { method: 'POST', body: JSON.stringify({ text, voice, format, speed }) as any, headers: { 'content-type': 'application/json' } as any }))
}

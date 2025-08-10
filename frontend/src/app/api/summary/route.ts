import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/sessionStore'
import { getGroqClient, getGroqModel } from '@/lib/groq'

export async function POST(req: NextRequest) {
  const { sessionToken } = await req.json().catch(() => ({}))
  const sess = sessionToken ? sessionStore.get(sessionToken) : undefined
  const groq = getGroqClient()
  const readTimeSec = 45
  let highlights: string[]
  let summaryText: string
  let usedGroq = false
  if (groq && sess) {
    try {
      const model = getGroqModel()
      const f = sess.fields
      const prompt = `Create a concise pre-consultation clinical summary for a doctor based on the following patient intake fields. Use 1-2 short paragraphs with medical tone, then provide 3-5 bullet highlights focusing on triage-critical info.

Fields:
- Symptoms: ${f.symptoms || '—'}
- Onset: ${f.onset || '—'}
- Chronic conditions/Allergies: ${f.conditionsAllergies || '—'}
- Medications: ${f.medications || '—'}
- Pain scale: ${f.painScale || '—'}
- Exposure/Travel: ${f.exposure || '—'}
- Age: ${f.age || '—'}
- Gender: ${f.gender || '—'}
- Additional notes: ${f.notes || '—'}

Return as JSON with keys: { "summary": string, "highlights": string[] }`;
      const resp = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: 'You are a concise clinical summarizer for emergency intake.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 400,
      })
  usedGroq = true
      const content = (resp.choices?.[0]?.message?.content || '').trim()
      // Handle code-fenced JSON (```json ... ```)
      let cleaned = content
      const fenced = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
      if (fenced) cleaned = fenced[1].trim()
      try {
        const parsed = JSON.parse(cleaned)
        summaryText = parsed.summary
        highlights = Array.isArray(parsed.highlights) ? parsed.highlights.slice(0, 5) : []
      } catch {
        // fallback: try to split lines
        summaryText = cleaned
        // Look for either markdown bullets or JSON-like highlights array
        const bulletLines = cleaned.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^[-•]\s*/, ''))
        const jsonArray = cleaned.match(/"highlights"\s*:\s*\[(.*?)\]/s)
        const fromJson = jsonArray ? jsonArray[1].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(s => s.replace(/^\s*"|"\s*$/g, '')).map(s => s.trim()) : []
        const merged = [...fromJson, ...bulletLines].filter(Boolean)
        highlights = merged.slice(0, 5)
      }
      sessionStore.addSummary(sess.token, summaryText, highlights)
    } catch (e) {
      console.warn('[api/summary] Groq call failed; falling back. Error:', (e as any)?.message || e)
      summaryText = 'Patient summary unavailable. Please review intake fields.'
      highlights = [
        'Intake captured via chatbot', 'Awaiting clinical review'
      ]
    }
  } else if (sess?.cachedSummaryText && sess?.cachedHighlights) {
    summaryText = sess.cachedSummaryText
    highlights = sess.cachedHighlights
  } else {
    summaryText = 'Patient summary unavailable. Please review intake fields.'
    highlights = [
      'Intake captured via chatbot', 'Awaiting clinical review'
    ]
  }
  // Ensure summaries history includes the current one if we didn't just add it
  if (sess) {
    const latest = sess.summaries?.[0]
    if (!latest || latest.summary !== summaryText) {
      sessionStore.addSummary(sess.token, summaryText, highlights)
    }
  }

  const summaries = sess?.summaries ?? []
  const latestCreatedAt = summaries[0]?.createdAt ?? Date.now()
  const history = summaries.slice(1).map(s => ({ id: s.id, createdAt: s.createdAt, summary: s.summary, highlights: s.highlights }))

  // Build a resilient PDF URL. Include a base64url payload so serverless stateless instances can still render.
  // Get base URL from environment or construct from request headers
  let baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    const host = req.headers.get('host')
    const protocol = req.headers.get('x-forwarded-proto') || (host?.includes('localhost') ? 'http' : 'https')
    baseUrl = `${protocol}://${host}`
  }
  
  const payloadObj = { summary: summaryText, highlights, fields: sess?.fields ?? {} }
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf-8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  // Use a valid token or create a generic one with payload for stateless rendering
  const token = sess?.token || `payload-${Date.now()}`
  const pdfUrl = `${baseUrl}/api/report/pdf/${token}?payload=${payloadB64}`
  await new Promise(r => setTimeout(r, 200))
  return NextResponse.json({ pdfUrl, highlights, readTimeSec, summary: summaryText, latestCreatedAt, history }, { headers: { 'x-groq-used': usedGroq ? '1' : '0' } })
}

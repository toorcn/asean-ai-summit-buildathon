import { NextRequest, NextResponse } from 'next/server'
import { sessionStore, type ChatMessage } from '@/lib/sessionStore'
import { getGroqClient, getGroqModel } from '@/lib/groq'

// Intake flow prompts. First question focuses on symptoms.
const QUESTIONS = [
  'What symptoms are you experiencing or what brings you to the hospital today?',
  'When did these symptoms start?',
  'Do you have any chronic conditions or allergies?',
  'Are you currently on any medications?',
  'How severe is the pain on a scale of 1-10?',
  'Have you had recent travel or exposure to illness?',
  'What\'s your age and gender?',
  'Any additional information you\'d like to add?'
]

export async function POST(req: NextRequest) {
  const { history = [], sessionToken }: { history: ChatMessage[]; sessionToken?: string } = await req.json()
  const sess = sessionStore.ensure(sessionToken)
  // persist messages
  sessionStore.upsertMessages(sess.token, history)
  const userTurns = history.filter((m: any) => m.role === 'user').length
  const nextIndex = Math.min(userTurns, QUESTIONS.length - 1)
  const done = userTurns >= QUESTIONS.length
  const groq = getGroqClient()
  let usedGroq = false
  if (groq) {
    try {
      const system = `You are a hospital pre-arrival intake assistant. Your goal is to efficiently collect key triage details in conversational steps while the patient is en route.
Ask one concise question at a time. Keep it simple and empathetic.
Target fields: symptoms, onset, chronic conditions/allergies, medications, pain scale (1-10), exposure/travel, age & gender, additional notes.
Stop asking when all are captured. Prefer yes/no questions when appropriate and numeric scales for severity. When your question is a yes/no, phrase clearly so the UI can offer quick buttons. When asking for pain scale, explicitly mention 1-10. When finished, reply with exactly: "Thanks! I've prepared your summary. You can review and share it now."`
      const messages = [
        { role: 'system', content: system },
        ...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      ] as any
      const model = getGroqModel()
      const resp = await groq.chat.completions.create({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 200,
      })
      usedGroq = true
      const content = resp.choices?.[0]?.message?.content?.trim() || (done ? `Thanks! I've prepared your summary. You can review and share it now.` : QUESTIONS[nextIndex])
      const replies = [{ id: crypto.randomUUID(), role: 'assistant', content }]
      return NextResponse.json({ replies, sessionToken: sess.token }, { headers: { 'x-groq-used': usedGroq ? '1' : '0' } })
    } catch (e) {
      // fall through to static flow
      console.warn('[api/chat] Groq call failed; falling back. Error:', (e as any)?.message || e)
    }
  }
  const replies = done
    ? [{ id: crypto.randomUUID(), role: 'assistant', content: 'Thanks! I\'ve prepared your summary. You can review and share it now.' }]
    : [{ id: crypto.randomUUID(), role: 'assistant', content: QUESTIONS[nextIndex] }]
  await new Promise(r => setTimeout(r, 300))
  return NextResponse.json({ replies, sessionToken: sess.token }, { headers: { 'x-groq-used': usedGroq ? '1' : '0' } })
}

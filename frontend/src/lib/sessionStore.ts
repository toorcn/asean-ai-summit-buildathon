// Simple in-memory session store. For production, replace with a DB or KV store.
// This persists per server instance only.

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string }

export interface IntakeFields {
  symptoms?: string
  onset?: string
  conditionsAllergies?: string
  medications?: string
  painScale?: string
  exposure?: string
  age?: string
  gender?: string
  notes?: string
}

export interface SessionData {
  token: string
  createdAt: number
  expiresAt: number
  messages: ChatMessage[]
  fields: IntakeFields
  completed: boolean
  cachedSummaryText?: string
  cachedHighlights?: string[]
  summaries?: Array<{
    id: string
    createdAt: number
    summary: string
    highlights: string[]
  }>
}

class SessionStore {
  private map = new Map<string, SessionData>()

  create(ttlMinutes = 60) {
    const token = crypto.randomUUID()
    const now = Date.now()
    const expiresAt = now + ttlMinutes * 60 * 1000
    const data: SessionData = { token, createdAt: now, expiresAt, messages: [], fields: {}, completed: false, summaries: [] }
    this.map.set(token, data)
    return data
  }

  get(token: string) {
    const s = this.map.get(token)
    if (!s) return undefined
    if (Date.now() > s.expiresAt) {
      this.map.delete(token)
      return undefined
    }
    return s
  }

  addSummary(token: string, summary: string, highlights: string[]) {
    const s = this.ensure(token)
    s.cachedSummaryText = summary
    s.cachedHighlights = highlights
    const entry = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      summary,
      highlights: [...highlights],
    }
    if (!s.summaries) s.summaries = []
    s.summaries.unshift(entry)
    // cap history to last 10
    if (s.summaries.length > 10) s.summaries = s.summaries.slice(0, 10)
    this.map.set(s.token, s)
    return entry
  }

  ensure(token?: string) {
    if (!token) return this.create()
    const existing = this.get(token)
    return existing ?? this.create()
  }

  upsertMessages(token: string, messages: ChatMessage[]) {
    const s = this.ensure(token)
    s.messages = messages
    // derive fields from user answers by index mapping
    const users = messages.filter(m => m.role === 'user')
    const get = (i: number) => users[i]?.content?.trim()
    s.fields.symptoms = get(0)
    s.fields.onset = get(1)
    s.fields.conditionsAllergies = get(2)
    s.fields.medications = get(3)
    s.fields.painScale = get(4)
    s.fields.exposure = get(5)
    // split age/gender rudimentarily
    const ageGender = get(6)
    if (ageGender) {
      s.fields.age = ageGender.match(/\d{1,3}/)?.[0]
      s.fields.gender = (/male|female|man|woman|non-binary|m|f/i.exec(ageGender)?.[0] ?? '').toString()
    }
    s.fields.notes = get(7)
    s.completed = users.length >= 8
    // extend expiry on activity
    s.expiresAt = Date.now() + 60 * 60 * 1000
    this.map.set(s.token, s)
    return s
  }

  listActive() {
    const now = Date.now()
    return Array.from(this.map.values())
      .filter(s => s.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt)
  }
}
// Ensure a singleton across Next.js dev HMR and per-route module reloads
const globalForSession = globalThis as unknown as { _sessionStore?: SessionStore }
export const sessionStore = globalForSession._sessionStore ?? (globalForSession._sessionStore = new SessionStore())

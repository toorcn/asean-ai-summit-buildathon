import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/sessionStore'

export async function GET() {
  const sessions = sessionStore.listActive().map(s => ({
    token: s.token,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    completed: s.completed,
    fields: s.fields,
  }))
  return NextResponse.json({ sessions })
}

export async function POST(_req: NextRequest) {
  const s = sessionStore.create()
  return NextResponse.json({ token: s.token, expiresAt: s.expiresAt })
}

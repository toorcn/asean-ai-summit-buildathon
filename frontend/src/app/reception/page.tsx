import { sessionStore } from '@/lib/sessionStore'

export default function ReceptionPage() {
  const sessions = sessionStore.listActive()
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Reception Dashboard</h1>
      <p className="text-white/60 text-sm">Active pre-arrival sessions. Click to view report.</p>
      <div className="grid gap-3">
        {sessions.map(s => (
          <a key={s.token} href={`/r/${s.token}`} className="block p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="font-medium">Session {s.token.slice(0,8)}</div>
              <div className={`text-xs ${s.completed ? 'text-emerald-300' : 'text-white/50'}`}>{s.completed ? 'Completed' : 'In progress'}</div>
            </div>
            <div className="text-xs text-white/60 mt-1">
              Symptoms: {s.fields.symptoms || '—'} | Pain: {s.fields.painScale || '—'} | Age: {s.fields.age || '—'} | Gender: {s.fields.gender || '—'}
            </div>
          </a>
        ))}
        {sessions.length === 0 && (
          <div className="text-sm text-white/60">No active sessions.</div>
        )}
      </div>
    </div>
  )
}

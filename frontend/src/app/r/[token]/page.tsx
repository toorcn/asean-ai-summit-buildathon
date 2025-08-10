import { notFound } from 'next/navigation'
import { sessionStore } from '@/lib/sessionStore'

function PrintButton({ pdfHref }: { pdfHref: string }) {
  'use client'
  return (
    <div className="flex gap-2">
      <a href={pdfHref} className="flex-1 px-4 py-3 rounded-lg bg-white/10 text-center">Download PDF</a>
      <button onClick={() => window.print()} className="flex-1 px-4 py-3 rounded-lg bg-brand-600">Print</button>
    </div>
  )
}

export default function ReportPage({ params }: { params: { token: string } }) {
  const session = sessionStore.get(params.token)
  if (!session) return notFound()
  const f = session.fields
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Patient Intake Report</h1>
        <div className="text-xs text-white/60">Session {params.token.slice(0,8)}</div>
      </div>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="font-medium mb-2">Summary</h2>
        {session.cachedSummaryText && (
          <p className="text-sm text-white/80 leading-relaxed mb-2">{session.cachedSummaryText}</p>
        )}
        {session.cachedHighlights && session.cachedHighlights.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-white/80 mb-2">
            {session.cachedHighlights.map((h, i) => (<li key={i}>{h}</li>))}
          </ul>
        )}
        <ul className="list-disc pl-5 text-sm text-white/80">
          <li>Symptoms: {f.symptoms || '—'}</li>
          <li>Onset: {f.onset || '—'}</li>
          <li>Conditions/Allergies: {f.conditionsAllergies || '—'}</li>
          <li>Medications: {f.medications || '—'}</li>
          <li>Pain scale: {f.painScale || '—'}</li>
          <li>Recent exposure: {f.exposure || '—'}</li>
          <li>Age: {f.age || '—'}</li>
          <li>Gender: {f.gender || '—'}</li>
          <li>Additional notes: {f.notes || '—'}</li>
        </ul>
      </section>

      <section className="rounded-lg border border-white/10 bg-white/5 p-4">
        <h2 className="font-medium mb-2">Timeline</h2>
        <div className="text-sm text-white/70">Created at: {new Date(session.createdAt).toLocaleString()}</div>
        <div className="text-sm text-white/70">Expires at: {new Date(session.expiresAt).toLocaleString()}</div>
        <div className="text-sm text-white/70">Status: {session.completed ? 'Completed' : 'In progress'}</div>
      </section>

  <PrintButton pdfHref={`/api/report/pdf/${session.token}`} />
    </div>
  )
}

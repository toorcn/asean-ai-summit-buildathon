"use client"

import clsx from 'clsx'

const modes = ['Fastest', 'Closest'] as const
export type Mode = typeof modes[number]

export function ComparisonToggle({ value, onChange }: { value: Mode, onChange: (v: Mode) => void }) {
  return (
    <div className="inline-flex p-1 rounded-lg bg-white/10 border border-white/10 text-xs">
      {modes.map(m => (
        <button key={m} onClick={() => onChange(m)} className={clsx('px-2 py-1 rounded-md', value === m ? 'bg-brand-600' : 'opacity-70')}>
          {m}
        </button>
      ))}
    </div>
  )
}

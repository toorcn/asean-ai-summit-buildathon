export function LoadingSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-16 skeleton" />
      ))}
    </div>
  )
}

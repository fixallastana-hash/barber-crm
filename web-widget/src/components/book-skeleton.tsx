type BookSkeletonProps = {
  showStickyButton?: boolean;
};

export function BookSkeleton({ showStickyButton = true }: BookSkeletonProps) {
  return (
    <main className="min-h-screen bg-surface px-4 py-6 pb-32">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="sk mb-3 h-3 w-20" />
            <div className="sk mb-2 h-8 w-44 rounded-lg" />
            <div className="sk h-3 w-24" />
          </div>
          <div className="sk h-12 w-12 shrink-0 rounded-xl bg-primary/40" />
        </div>

        {/* Progress — 4 circles */}
        <div className="mb-6 flex items-center gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="sk h-8 w-8 rounded-full" />
              <div className="sk h-2.5 w-9" />
            </div>
          ))}
        </div>

        {/* Section head */}
        <div className="mb-4">
          <div className="sk mb-2.5 h-2.5 w-12" />
          <div className="sk mb-2.5 h-6 w-52 rounded-lg" />
          <div className="sk h-3 w-24" />
        </div>

        {/* Category chips */}
        <div className="mb-4 -mx-4 flex gap-2 overflow-hidden px-4">
          <div className="sk h-10 w-24 shrink-0 rounded-full" />
          <div className="sk h-10 w-20 shrink-0 rounded-full" />
          <div className="sk h-10 w-28 shrink-0 rounded-full" />
          <div className="sk h-10 w-16 shrink-0 rounded-full" />
        </div>

        {/* Service cards — 3 штуки */}
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
            >
              <div className="sk h-7 w-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="sk mb-2 h-4 w-3/4" />
                <div className="sk h-3 w-12" />
              </div>
              <div className="sk h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      {showStickyButton && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto w-full max-w-md">
            <div className="sk h-14 w-full rounded-xl bg-primary/40" />
          </div>
        </div>
      )}
    </main>
  );
}
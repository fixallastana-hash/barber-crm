export function ReviewSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto sk h-12 w-12 rounded-2xl" />

        <div className="mt-5 flex justify-center">
          <div className="sk h-2.5 w-20" />
        </div>

        <div className="mt-2 flex justify-center">
          <div className="sk h-7 w-44 rounded-lg" />
        </div>

        <div className="mt-3 flex justify-center">
          <div className="sk h-3 w-52" />
        </div>

        <div className="mt-8 flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <div key={star} className="sk h-12 w-12 rounded-xl" />
          ))}
        </div>

        <div className="mt-5 flex justify-center">
          <div className="sk h-3 w-24" />
        </div>

        <div className="mt-6 sk h-14 w-full rounded-xl bg-primary/40" />
      </section>
    </main>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [slug, setSlug] = useState('');

  const openSalon = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = slug.trim();
    if (!value) return;
    router.push('/book?slug=' + encodeURIComponent(value));
  };

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-6">
      <form
        onSubmit={openSalon}
        className="w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-sm sm:p-8"
      >
        <h1 className="mb-3 text-center text-3xl font-semibold tracking-tight text-ink">
          Barber CRM
        </h1>
        <p className="mb-6 text-center text-base leading-6 text-muted">
          Введите название салона, чтобы записаться
        </p>

        <label htmlFor="salon-slug" className="sr-only">
          Название салона
        </label>
        <input
          id="salon-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="Название салона"
          className="mb-4 h-14 w-full rounded-lg border border-line bg-surface px-4 text-lg text-ink outline-none transition placeholder:text-muted focus:border-primary focus:bg-card focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          disabled={!slug.trim()}
          className="h-14 w-full rounded-lg bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          Открыть салон
        </button>
      </form>
    </main>
  );
}
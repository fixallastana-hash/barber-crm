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
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-6">
      <form onSubmit={openSalon} className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">Barber CRM</h1>
        <label htmlFor="salon-slug" className="sr-only">Название салона</label>
        <input
          id="salon-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="Название салона"
          className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900 outline-none focus:border-gray-700 focus:ring-2 focus:ring-gray-200"
        />
        <button
          type="submit"
          disabled={!slug.trim()}
          className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Открыть салон
        </button>
      </form>
    </main>
  );
}

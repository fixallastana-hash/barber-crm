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
    <main className="flex min-h-screen items-center justify-center px-4 py-6">
      <form
        onSubmit={openSalon}
        className="w-full max-w-md rounded-2xl border border-[#E5E5E5] bg-white p-6 shadow-sm"
      >
        <h1 className="mb-2 text-center text-3xl font-bold text-[#1A1A1A]">
          Barber CRM
        </h1>
        <p className="mb-6 text-center text-sm text-[#7A7A7A]">
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
          className="mb-4 w-full rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] px-4 py-3 text-base text-[#1A1A1A] outline-none transition placeholder:text-[#7A7A7A] focus:border-[#F4C842] focus:bg-white focus:ring-4 focus:ring-[#F4C842]/20"
        />
        <button
          type="submit"
          disabled={!slug.trim()}
          className="w-full rounded-xl bg-[#F4C842] px-4 py-3 font-semibold text-[#1A1A1A] transition hover:bg-[#E5B935] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Открыть салон
        </button>
      </form>
    </main>
  );
}
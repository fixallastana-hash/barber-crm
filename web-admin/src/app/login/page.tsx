'use client';

import { useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebaseAuth } from '@/lib/firebase';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      const auth = getFirebaseAuth();

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      router.push('/app');
    } catch {
      setError('Неверный email или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-8 sm:px-6">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-[430px]">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#171717] text-xl font-semibold text-white shadow-sm">
              B
            </div>

            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a19d96]">
              BARBER CRM
            </div>

            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#171717]">
              С возвращением
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#85817b]">
              Войдите, чтобы управлять вашим салоном
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-[#e7e4df] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-7"
          >
            {error && (
              <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {error}
              </div>
            )}

            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-[#403d39]">
                Email
              </span>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl border border-[#dedbd6] bg-[#faf9f7] px-4 text-[15px] text-[#242220] outline-none transition placeholder:text-[#aaa6a0] focus:border-[#aaa59d] focus:bg-white focus:ring-4 focus:ring-[#171717]/5"
              />
            </label>

            <label className="mb-6 block">
              <span className="mb-2 block text-sm font-medium text-[#403d39]">
                Пароль
              </span>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Введите пароль"
                className="h-12 w-full rounded-xl border border-[#dedbd6] bg-[#faf9f7] px-4 text-[15px] text-[#242220] outline-none transition placeholder:text-[#aaa6a0] focus:border-[#aaa59d] focus:bg-white focus:ring-4 focus:ring-[#171717]/5"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Входим...' : 'Войти'}
            </button>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#ebe8e3]" />
              <span className="text-xs text-[#aaa6a0]">
                или
              </span>
              <div className="h-px flex-1 bg-[#ebe8e3]" />
            </div>

            <p className="text-center text-sm text-[#77736d]">
              Нет аккаунта?{' '}
              <Link
                href="/register"
                className="font-semibold text-[#171717] underline decoration-[#c7c3bd] underline-offset-4 transition hover:decoration-[#171717]"
              >
                Зарегистрировать салон
              </Link>
            </p>
          </form>

          <p className="mt-6 text-center text-xs text-[#aaa6a0]">
            Управление салоном в одном месте
          </p>
        </div>
      </div>
    </main>
  );
}

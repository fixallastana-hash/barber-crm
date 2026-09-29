'use client';

import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import Link from 'next/link';
import { getFirebaseAuth } from '@/lib/firebase';

function mapResetError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Некорректный email.';
    case 'auth/too-many-requests':
      return 'Слишком много попыток. Попробуйте позже.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Проверьте NEXT_PUBLIC_FIREBASE_API_KEY в .env.local.';
    default:
      return `Не удалось отправить письмо (${code || 'unknown'}). Попробуйте позже.`;
  }
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setSent(true);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';

      // Для безопасности не показываем, существует ли email.
      if (code === 'auth/user-not-found') {
        setSent(true);
      } else {
        setError(mapResetError(code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 py-8 sm:px-6">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="w-full max-w-[430px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#171717] text-xl font-semibold text-white shadow-sm">
              B
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a19d96]">
              BARBER CRM
            </div>
            <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-[#171717]">
              Восстановление пароля
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#85817b]">
              Укажите email — пришлём ссылку для нового пароля
            </p>
          </div>

          {sent ? (
            <div className="rounded-[24px] border border-[#e7e4df] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm leading-5 text-green-800">
                Если <strong>{email}</strong> зарегистрирован, письмо со ссылкой
                отправлено. Проверьте почту и папку «Спам».
              </div>
              <Link
                href="/login"
                className="mt-5 block text-center text-sm font-semibold text-[#171717] underline decoration-[#c7c3bd] underline-offset-4 transition hover:decoration-[#171717]"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-[24px] border border-[#e7e4df] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-7"
            >
              {error && (
                <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                  {error}
                </div>
              )}

              <label className="mb-6 block">
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

              <button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Отправляем...' : 'Отправить ссылку'}
              </button>

              <p className="mt-6 text-center text-sm text-[#77736d]">
                Вспомнили пароль?{' '}
                <Link
                  href="/login"
                  className="font-semibold text-[#171717] underline decoration-[#c7c3bd] underline-offset-4 transition hover:decoration-[#171717]"
                >
                  Войти
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
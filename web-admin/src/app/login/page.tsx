'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getFirebaseAuth } from '@/lib/firebase';
import { useAuth } from '@/lib/auth-context';

function mapFirebaseError(code: string): string {
  switch (code) {
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Проверьте NEXT_PUBLIC_FIREBASE_API_KEY в .env.local и пересоберите проект.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Неверный email или пароль.';
    case 'auth/user-disabled':
      return 'Аккаунт отключён. Обратитесь к владельцу салона.';
    case 'auth/operation-not-allowed':
      return 'Провайдер Email/Password выключен в Firebase Console.';
    case 'auth/too-many-requests':
      return 'Слишком много попыток входа. Попробуйте позже.';
    case 'auth/network-request-failed':
      return 'Нет связи с сервером. Проверьте интернет.';
    case 'auth/invalid-email':
      return 'Некорректный email.';
    default:
      return `Не удалось войти (${code || 'unknown'}). Попробуйте ещё раз.`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, isTenantMissing } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Редирект ТОЛЬКО когда auth-context подтвердил, что user получен.
  // Это убирает гонку: signIn завершается раньше, чем onIdTokenChanged
  // успевает установить user, и /app/layout может выкинуть обратно на /login.
  useEffect(() => {
    if (authLoading) return;
    if (user && user.tenantId) {
      router.replace('/app');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      );
      // Никакого router.push здесь — редирект сделает useEffect выше,
      // когда auth-context получит user с tenantId.
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      setError(mapFirebaseError(code));
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
              С возвращением
            </h1>

            <p className="mt-2 text-sm leading-6 text-[#85817b]">
              Войдите, чтобы управлять вашим салоном
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[24px] border border-[#e7e4df] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-7"
          >
            {error && (
              <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {error}
              </div>
            )}

            {isTenantMissing && (
              <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-800">
                Аккаунт не привязан к салону. Обратитесь к владельцу платформы.
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
              disabled={loading || authLoading}
              className="h-12 w-full rounded-xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Входим...' : 'Войти'}
            </button>

            <div className="mt-4 text-center">
              <Link
                href="/forgot-password"
                className="text-sm text-[#77736d] underline decoration-[#c7c3bd] underline-offset-4 transition hover:text-[#171717] hover:decoration-[#171717]"
              >
                Забыли пароль?
              </Link>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#ebe8e3]" />
              <span className="text-xs text-[#aaa6a0]">или</span>
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
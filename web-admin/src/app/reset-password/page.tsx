'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getFirebaseAuth } from '@/lib/firebase';

type VerifyState =
  | { status: 'loading' }
  | { status: 'valid'; email: string }
  | { status: 'invalid'; reason: string };

function mapVerifyError(code: string): string {
  switch (code) {
    case 'auth/expired-action-code':
      return 'Ссылка истекла. Запросите новую.';
    case 'auth/invalid-action-code':
      return 'Ссылка недействительна. Возможно, её уже использовали.';
    case 'auth/user-disabled':
      return 'Аккаунт отключён.';
    case 'auth/user-not-found':
      return 'Аккаунт не найден.';
    default:
      return `Не удалось проверить ссылку (${code || 'unknown'}).`;
  }
}

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [verify, setVerify] = useState<VerifyState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!oobCode || mode !== 'resetPassword') {
      setVerify({
        status: 'invalid',
        reason: 'Ссылка недействительна или открыта без параметров.',
      });
      return;
    }

    let cancelled = false;

    verifyPasswordResetCode(getFirebaseAuth(), oobCode)
      .then((email) => {
        if (cancelled) return;
        setVerify({ status: 'valid', email });
      })
      .catch((err) => {
        if (cancelled) return;
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code?: unknown }).code)
            : '';
        setVerify({ status: 'invalid', reason: mapVerifyError(code) });
      });

    return () => {
      cancelled = true;
    };
  }, [oobCode, mode]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Пароль должен быть минимум 8 символов.');
      return;
    }
    if (password !== password2) {
      setError('Пароли не совпадают.');
      return;
    }
    if (!oobCode) {
      setError('Ссылка недействительна.');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password);
      setDone(true);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code)
          : '';
      setError(mapVerifyError(code));
    } finally {
      setSubmitting(false);
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
              Новый пароль
            </h1>
          </div>

          {verify.status === 'loading' && (
            <div className="rounded-[24px] border border-[#e7e4df] bg-white p-6 text-center text-sm text-[#85817b] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              Проверяем ссылку...
            </div>
          )}

          {verify.status === 'invalid' && (
            <div className="rounded-[24px] border border-[#e7e4df] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                {verify.reason}
              </div>
              <Link
                href="/forgot-password"
                className="mt-5 block text-center text-sm font-semibold text-[#171717] underline decoration-[#c7c3bd] underline-offset-4 transition hover:decoration-[#171717]"
              >
                Запросить новую ссылку
              </Link>
            </div>
          )}

          {verify.status === 'valid' && !done && (
            <form
              onSubmit={handleSubmit}
              className="rounded-[24px] border border-[#e7e4df] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:p-7"
            >
              <p className="mb-5 text-sm leading-5 text-[#77736d]">
                Меняем пароль для <strong className="text-[#171717]">{verify.email}</strong>
              </p>

              {error && (
                <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                  {error}
                </div>
              )}

              <label className="mb-5 block">
                <span className="mb-2 block text-sm font-medium text-[#403d39]">
                  Новый пароль
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Минимум 8 символов"
                  className="h-12 w-full rounded-xl border border-[#dedbd6] bg-[#faf9f7] px-4 text-[15px] text-[#242220] outline-none transition placeholder:text-[#aaa6a0] focus:border-[#aaa59d] focus:bg-white focus:ring-4 focus:ring-[#171717]/5"
                />
              </label>

              <label className="mb-6 block">
                <span className="mb-2 block text-sm font-medium text-[#403d39]">
                  Повторите пароль
                </span>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Ещё раз"
                  className="h-12 w-full rounded-xl border border-[#dedbd6] bg-[#faf9f7] px-4 text-[15px] text-[#242220] outline-none transition placeholder:text-[#aaa6a0] focus:border-[#aaa59d] focus:bg-white focus:ring-4 focus:ring-[#171717]/5"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-[#171717] text-sm font-semibold text-white transition hover:bg-[#292929] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </form>
          )}

          {done && (
            <div className="rounded-[24px] border border-[#e7e4df] bg-white p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm leading-5 text-green-800">
                Пароль изменён. Теперь можно войти с новым паролем.
              </div>
              <Link
                href="/login"
                className="mt-5 block text-center text-sm font-semibold text-[#171717] underline decoration-[#c7c3bd] underline-offset-4 transition hover:decoration-[#171717]"
              >
                Войти
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#f7f6f3] px-4 py-8 sm:px-6">
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
          <div className="w-full max-w-[430px] rounded-[24px] border border-[#e7e4df] bg-white p-6 text-center text-sm text-[#85817b] shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
            Загрузка...
          </div>
        </div>
      </main>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
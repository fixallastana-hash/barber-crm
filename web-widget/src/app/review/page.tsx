'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { ReviewSkeleton } from '@/components/review-skeleton';

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-full w-full"
    >
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.56l-5.9 3.11 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
}

function ReviewForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const appointmentId = searchParams.get('appointmentId') ?? '';

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!token || !appointmentId || rating < 1) {
      setError('Выберите оценку от 1 до 5 звёзд.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const submitReview = httpsCallable(
        getFirebaseFunctions(),
        'submitReview',
      );

      await submitReview({ appointmentId, token, rating });
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось отправить оценку.',
      );
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
        <section className="w-full max-w-sm rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-3xl text-ink">
            ✓
          </div>

          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
            Ваша оценка
          </div>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
            Спасибо за оценку!
          </h1>

          <p className="mt-3 text-base leading-6 text-muted">
            Ваш отзыв поможет нам становиться лучше.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-8">
      <section className="w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-ink">
          ★
        </div>

        <div className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.15em] text-muted">
          Barber CRM
        </div>

        <h1 className="mt-2 text-center text-3xl font-semibold tracking-tight text-ink">
          Оцените визит
        </h1>

        <p className="mt-3 text-center text-base leading-6 text-muted">
          Расскажите, как прошёл ваш визит.
        </p>

        <div
          className="mt-8 flex items-center justify-center gap-2"
          onMouseLeave={() => setHoverRating(0)}
        >
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= (hoverRating || rating);

            return (
              <button
                key={star}
                type="button"
                aria-label={`Оценка ${star} из 5`}
                aria-pressed={rating === star}
                onMouseEnter={() => setHoverRating(star)}
                onFocus={() => setHoverRating(star)}
                onBlur={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className={[
                  'h-12 w-12 transition-transform sm:h-14 sm:w-14',
                  active ? 'scale-105 text-primary' : 'text-line',
                  'hover:scale-110',
                ].join(' ')}
              >
                <StarIcon filled={active} />
              </button>
            );
          })}
        </div>

        <div className="mt-5 text-center text-base font-medium text-ink">
          {rating === 0 ? 'Выберите оценку' : `${rating} из 5`}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || rating < 1}
          className="mt-6 h-14 w-full rounded-xl bg-primary text-base font-semibold text-ink transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Отправляем...' : 'Отправить оценку'}
        </button>
      </section>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <ReviewForm />
    </Suspense>
  );
}
'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

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
      <main className="review-page">
        <section className="review-card review-success-card">
          <div className="review-success-icon" aria-hidden="true">
            ✓
          </div>

          <div className="review-kicker">ВАША ОЦЕНКА</div>

          <h1>Спасибо за оценку!</h1>

          <p>
            Ваш отзыв поможет нам становиться лучше.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="review-page">
      <section className="review-card">
        <div className="review-brand-mark" aria-hidden="true">
          ★
        </div>

        <div className="review-kicker">BARBER CRM</div>

        <h1>Оцените визит</h1>

        <p className="review-subtitle">
          Расскажите, как прошёл ваш визит.
        </p>

        <div
          className="review-stars"
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
                className={
                  active
                    ? 'review-star review-star-active'
                    : 'review-star'
                }
              >
                {active ? '★' : '☆'}
              </button>
            );
          })}
        </div>

        <div className="review-rating-caption">
          {rating === 0 ? 'Выберите оценку' : `${rating} из 5`}
        </div>

        {error && (
          <div className="review-error" role="alert">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || rating < 1}
          className="review-submit"
        >
          {sending ? 'Отправляем...' : 'Отправить оценку'}
        </button>
      </section>
    </main>
  );
}

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <main className="review-page">
          <section className="review-card review-loading-card">
            Загрузка...
          </section>
        </main>
      }
    >
      <ReviewForm />
    </Suspense>
  );
}

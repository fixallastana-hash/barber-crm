'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

function ReviewForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const appointmentId = searchParams.get('appointmentId') || '';
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
      const submitReview = httpsCallable(getFirebaseFunctions(), 'submitReview');
      await submitReview({ appointmentId, token, rating });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить оценку.');
    } finally {
      setSending(false);
    }
  };

  if (submitted) {
    return <div className="rounded-xl bg-white p-8 text-center text-xl font-semibold shadow">Спасибо за оценку!</div>;
  }

  return (
    <section className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
      <h1 className="mb-3 text-2xl font-bold">Оцените визит</h1>
      <p className="mb-6 text-gray-600">Как прошёл ваш визит?</p>
      <div className="mb-6 flex justify-center gap-1" onMouseLeave={() => setHoverRating(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= (hoverRating || rating);
          return (
            <button key={star} type="button" aria-label={'Оценка ' + star + ' из 5'}
              onMouseEnter={() => setHoverRating(star)} onFocus={() => setHoverRating(star)}
              onBlur={() => setHoverRating(0)} onClick={() => setRating(star)}
              className={'text-[60px] leading-none transition-colors ' + (active ? 'text-yellow-400' : 'text-gray-300')}>
              {active ? '★' : '☆'}
            </button>
          );
        })}
      </div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={() => void submit()} disabled={sending}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
        {sending ? 'Отправка...' : 'Отправить оценку'}
      </button>
    </section>
  );
}

export default function ReviewPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <Suspense fallback={<p>Загрузка...</p>}>
        <ReviewForm />
      </Suspense>
    </main>
  );
}

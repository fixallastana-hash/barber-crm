'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';

export default function RegisterPage() {
  const router = useRouter();
  const [salonName, setSalonName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const registerSalon = httpsCallable(getFirebaseFunctions(), 'registerSalon');
      await registerSalon({ salonName, email: email.trim(), password });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-wrap">
        <div className="auth-brand">
          <div className="auth-mark">B</div>
          <div className="auth-kicker">BARBER CRM</div>
          <h1 className="auth-title">Создайте салон</h1>
          <p className="auth-subtitle">Начните управлять записями, мастерами и клиентами</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-card">
          {error && <div className="auth-error">{error}</div>}

          <label className="auth-field">
            <span className="auth-label">Название салона</span>
            <input className="auth-input" type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)} required placeholder="Название салона" />
          </label>

          <label className="auth-field">
            <span className="auth-label">Email</span>
            <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          </label>

          <label className="auth-field">
            <span className="auth-label">Пароль</span>
            <input className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Минимум 8 символов" />
          </label>

          <button type="submit" disabled={loading} className="auth-submit">
            {loading ? 'Регистрация...' : 'Зарегистрировать салон'}
          </button>

          <div className="auth-divider">или</div>
          <p className="auth-footer">Уже есть аккаунт? <Link href="/login" className="auth-link">Войти</Link></p>
        </form>

        <p className="auth-note">После регистрации вы получите доступ владельца</p>
      </div>
    </main>
  );
}

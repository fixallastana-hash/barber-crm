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
      const functions = getFirebaseFunctions();
      const registerSalon = httpsCallable(functions, 'registerSalon');
      await registerSalon({ salonName, email, password });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6 text-center">Регистрация салона</h1>
        {error && <p className="mb-4 text-red-600 text-sm">{error}</p>}
        <label className="block mb-4">
          <span className="text-sm text-gray-700">Название салона</span>
          <input type="text" value={salonName} onChange={(e) => setSalonName(e.target.value)} required className="mt-1 w-full px-3 py-2 border rounded" />
        </label>
        <label className="block mb-4">
          <span className="text-sm text-gray-700">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1 w-full px-3 py-2 border rounded" />
        </label>
        <label className="block mb-6">
          <span className="text-sm text-gray-700">Пароль (мин. 8 символов)</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1 w-full px-3 py-2 border rounded" />
        </label>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
        <p className="mt-4 text-sm text-center text-gray-600">
          Уже есть аккаунт? <Link href="/login" className="text-blue-600">Войти</Link>
        </p>
      </form>
    </main>
  );
}

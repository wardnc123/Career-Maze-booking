'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type PageState =
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pageState, setPageState] = useState<PageState>({ kind: 'form' });

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!username.trim()) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setPageState({ kind: 'submitting' });
    setFieldErrors({});

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('adminToken', data.token);
        router.push('/admin/dashboard');
        return;
      }

      if (res.status === 401) {
        setPageState({ kind: 'error', message: 'Invalid username or password' });
        return;
      }

      const data = await res.json().catch(() => null);
      setPageState({
        kind: 'error',
        message: data?.error || 'Something went wrong. Please try again.',
      });
    } catch {
      setPageState({ kind: 'error', message: 'Network error. Please try again.' });
    }
  }

  const isSubmitting = pageState.kind === 'submitting';

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        <form onSubmit={handleSubmit} noValidate className="bg-white rounded-lg shadow-md p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-900 text-center">Admin Login</h1>

          {pageState.kind === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm text-center">
              {pageState.message}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.username ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.username}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
            {fieldErrors.username && (
              <p id="username-error" className="text-red-500 text-xs mt-1">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                fieldErrors.password ? 'border-red-400' : 'border-gray-300'
              }`}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}

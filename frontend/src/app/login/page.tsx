'use client';

import { HardHat, Wrench } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { API_BASE, TECH_TOKEN_KEY } from '@/lib/api';
import { Technician } from '@/lib/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState<'dispatcher' | 'tech'>(params.get('role') === 'tech' ? 'tech' : 'dispatcher');
  const [email, setEmail] = useState('dispatcher@novahvac.com');
  const [password, setPassword] = useState('demo1234');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    document.cookie = `hvac_session=${encodeURIComponent(email)}; path=/; max-age=86400`;
    router.push('/');
    router.refresh();
  }

  async function techSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/tech/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Sign-in failed');
      const data = body as { token: string; technician: Technician };
      window.localStorage.setItem(TECH_TOKEN_KEY, data.token);
      document.cookie = `hvac_tech=${encodeURIComponent(data.token)}; path=/; max-age=86400`;
      router.push('/tech');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600 text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">HVAC AI Dispatcher</p>
            <p className="text-sm text-orange-500">CRM & call management</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setRole('dispatcher')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition ${
              role === 'dispatcher' ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Wrench className="h-4 w-4" /> Dispatcher
          </button>
          <button
            type="button"
            onClick={() => setRole('tech')}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition ${
              role === 'tech' ? 'bg-white text-purple-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HardHat className="h-4 w-4" /> Technician
          </button>
        </div>

        {role === 'dispatcher' ? (
          <form onSubmit={signIn} className="card space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Work email
              <input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input className="input mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button type="submit" className="btn-primary w-full justify-center">
              Sign in
            </button>
            <p className="text-center text-xs text-slate-400">Demo build — any credentials sign you in to the dashboard.</p>
          </form>
        ) : (
          <form onSubmit={techSignIn} className="card space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Phone number
              <input
                className="input mt-1"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (415) 555-0160"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              PIN
              <input
                className="input mt-1"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                required
              />
            </label>
            {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            <button type="submit" className="btn-primary w-full justify-center" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in to field app'}
            </button>
            <p className="text-center text-xs text-slate-400">
              Technicians sign in with their phone number and the PIN shown on the admin Technicians page.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

'use client';

import { Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('dispatcher@novahvac.com');
  const [password, setPassword] = useState('demo1234');

  function signIn(e: React.FormEvent) {
    e.preventDefault();
    document.cookie = `hvac_session=${encodeURIComponent(email)}; path=/; max-age=86400`;
    router.push('/');
    router.refresh();
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
      </div>
    </main>
  );
}

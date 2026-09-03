'use client';

import { CalendarDays, LayoutDashboard, LogOut, MessageCircle, Phone, PhoneCall, Users, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: PhoneCall },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/technicians', label: 'Technicians', icon: Wrench },
  { href: '/calendar', label: 'Calendar', icon: Users },
  { href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { href: '/phone', label: 'Phone & AI Agent', icon: Phone },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white">
          <Wrench className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight text-slate-900">HVAC AI</p>
          <p className="text-xs font-medium text-orange-500">Dispatcher</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active ? 'bg-purple-50 text-purple-700 ring-1 ring-purple-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-orange-500' : 'text-slate-400'}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => {
          document.cookie = 'hvac_session=; Max-Age=0; path=/';
          router.push('/login');
        }}
        className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}

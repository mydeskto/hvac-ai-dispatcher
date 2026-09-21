import { Sidebar } from '@/components/Sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}

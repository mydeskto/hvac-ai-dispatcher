import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HVAC AI Dispatcher — CRM & Call Management',
  description:
    'AI voice dispatcher for HVAC businesses: automated call handling, WhatsApp booking confirmations, technician scheduling and live call analytics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white antialiased`}>{children}</body>
    </html>
  );
}

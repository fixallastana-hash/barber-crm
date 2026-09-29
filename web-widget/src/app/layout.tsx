import type { Metadata } from 'next';
import './globals.css';
import { WidgetFooter } from '@/components/widget-footer';

export const metadata: Metadata = {
  title: 'Barber CRM Widget',
  description: 'Онлайн-запись',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="flex min-h-screen flex-col bg-[#FAFAFA] text-[#1A1A1A]">
        <div className="flex-1">{children}</div>
        <WidgetFooter />
      </body>
    </html>
  );
}
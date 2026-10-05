import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

export const metadata: Metadata = {
  title: 'Barber CRM Admin',
  description: 'Административная панель для управления салоном красоты и барбершопом',
  openGraph: {
    title: 'Barber CRM Admin',
    description: 'Административная панель для управления салоном красоты и барбершопом',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

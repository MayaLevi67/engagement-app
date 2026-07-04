import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Wedding Planner',
  description: 'AI-powered wedding planning',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}

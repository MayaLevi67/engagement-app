import { setRequestLocale } from 'next-intl/server';

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main className="p-8">Admin (ADMIN only)</main>;
}

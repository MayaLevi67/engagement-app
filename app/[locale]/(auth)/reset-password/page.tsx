import { setRequestLocale } from 'next-intl/server';
import { ResetForm } from './reset-form';

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ResetForm token={token ?? ''} />
    </main>
  );
}

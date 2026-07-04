import { setRequestLocale } from 'next-intl/server';
import { ForgotForm } from './forgot-form';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <ForgotForm />
    </main>
  );
}

import { setRequestLocale } from 'next-intl/server';
import { RegisterForm } from './register-form';

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <RegisterForm />
    </main>
  );
}

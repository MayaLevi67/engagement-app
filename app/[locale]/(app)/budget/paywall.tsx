import { useTranslations } from 'next-intl';
import { UpgradeButton } from '../upgrade-button';

export function Paywall() {
  const t = useTranslations('Premium');
  return (
    <section className="flex flex-col items-center gap-3 rounded-card bg-surface p-8 text-center shadow-sm">
      <h1 className="font-display text-2xl text-text">{t('budgetPaywallTitle')}</h1>
      <p className="text-sm text-muted">{t('budgetPaywallBody')}</p>
      <UpgradeButton />
    </section>
  );
}

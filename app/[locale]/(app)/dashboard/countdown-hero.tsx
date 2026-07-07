import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';

interface CountdownHeroProps {
  locale: string;
  partner1Name: string | null;
  partner2Name: string | null;
  countdownDays: number | null;
  dateIsApproximate: boolean;
  weddingDate: string | null;
}

export function CountdownHero(props: CountdownHeroProps) {
  const t = useTranslations('Dashboard');
  const { partner1Name, partner2Name, countdownDays, dateIsApproximate } = props;

  const couple =
    partner1Name && partner2Name
      ? t('heroCouple', { p1: partner1Name, p2: partner2Name })
      : partner1Name
        ? t('heroCoupleSolo', { p1: partner1Name })
        : null;

  return (
    <section className="rounded-card bg-surface p-8 text-center shadow-sm">
      {couple ? <h1 className="font-display text-3xl text-text">{couple}</h1> : null}
      {countdownDays == null ? (
        <div className="mt-3">
          <p className="text-sm text-muted">{t('noDateTitle')}</p>
          <Link href="/settings/wedding" className="mt-2 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
            {t('noDateCta')}
          </Link>
        </div>
      ) : countdownDays < 0 ? (
        <p className="mt-3 font-body text-lg text-text">{t('datePassed')}</p>
      ) : (
        <>
          <p className="mt-3 font-display text-2xl text-primary">{t('daysToGo', { days: countdownDays })}</p>
          {dateIsApproximate ? <p className="mt-1 text-xs text-muted">{t('dateApproximate')}</p> : null}
        </>
      )}
    </section>
  );
}

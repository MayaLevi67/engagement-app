import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { Hero } from '@/components/editorial/hero';

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
  const { locale, partner1Name, partner2Name, countdownDays, dateIsApproximate, weddingDate } = props;

  const couple =
    partner1Name && partner2Name
      ? t('heroCouple', { p1: partner1Name, p2: partner2Name })
      : partner1Name
        ? t('heroCoupleSolo', { p1: partner1Name })
        : null;

  const countdownLine =
    countdownDays == null
      ? null
      : dateIsApproximate && weddingDate
        ? t('dateApproximateAround', {
            date: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(weddingDate)),
          })
        : countdownDays < 0
          ? t('datePassed')
          : t('daysToGo', { days: countdownDays });

  return (
    <>
      <Hero coupleName={couple} partner1Name={partner1Name} partner2Name={partner2Name}>
        {countdownLine}
      </Hero>
      {countdownDays == null ? (
        <div className="text-center">
          <p className="text-sm text-muted">{t('noDateTitle')}</p>
          <Link href="/settings/wedding" className="mt-2 inline-block rounded-card bg-primary px-4 py-2 text-sm font-medium text-background">
            {t('noDateCta')}
          </Link>
        </div>
      ) : null}
    </>
  );
}

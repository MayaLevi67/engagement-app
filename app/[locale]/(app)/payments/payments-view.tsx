'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PayerRole } from '@prisma/client';
import { useRouter } from '@/lib/i18n/navigation';
import { deleteTaskPayment } from '@/lib/actions/payments';
import { rollup } from '@/lib/payments/rollup';
import { payerDisplayName, type PayerLabels } from '@/lib/payments/payer';
import { PaymentForm } from '../payment-form';
import { DonutChart } from '@/components/charts/donut-chart';
import { payerToken } from '@/components/charts/chart-palette';

export interface SerializedPayment {
  id: string;
  amount: number;
  payer: PayerRole;
  payerLabel: string | null;
  paidOn: string | null;
  note: string | null;
}

export interface SerializedPaymentRow {
  taskId: string;
  title: string;
  vendorName: string | null;
  cost: number | null;
  paid: number;
  remaining: number | null;
  payments: SerializedPayment[];
}

interface PaymentsViewProps {
  rows: SerializedPaymentRow[];
  locale: string;
  partner1Name: string | null;
  partner2Name: string | null;
}

function formatMoney(amount: number, locale: string): string {
  return `₪${amount.toLocaleString(locale)}`;
}

interface PaymentTaskRowProps {
  row: SerializedPaymentRow;
  locale: string;
  partner1Name: string | null;
  partner2Name: string | null;
  payerLabels: PayerLabels;
  onChanged: () => void;
}

function PaymentTaskRow({
  row,
  locale,
  partner1Name,
  partner2Name,
  payerLabels,
  onChanged,
}: PaymentTaskRowProps) {
  const t = useTranslations('Payments');
  const [expanded, setExpanded] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const fmt = (n: number) => formatMoney(n, locale);

  async function handleDelete(paymentId: string) {
    setError(false);
    setPending(true);
    const result = await deleteTaskPayment(paymentId);
    setPending(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    onChanged();
  }

  return (
    <div className="flex flex-col gap-2 rounded-card bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="grid grid-cols-2 items-center gap-2 text-start sm:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem_6rem]"
      >
        <span className="col-span-2 text-sm text-text sm:col-span-1">{row.title}</span>
        <span className="text-xs text-muted">{row.vendorName ?? ''}</span>
        <span className="text-xs text-muted sm:text-end">{row.cost != null ? fmt(row.cost) : ''}</span>
        <span className="text-xs text-muted sm:text-end">{fmt(row.paid)}</span>
        <span className="text-xs text-muted sm:text-end">
          {row.cost != null ? ((row.remaining ?? 0) < 0 ? t('overpaid') : fmt(row.remaining ?? 0)) : ''}
        </span>
      </button>

      {expanded ? (
        <div className="flex flex-col gap-2 border-t border-muted/20 pt-2">
          {row.payments.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {row.payments.map((payment) => (
                <li key={payment.id}>
                  {editingPaymentId === payment.id ? (
                    <PaymentForm
                      taskId={row.taskId}
                      partner1Name={partner1Name}
                      partner2Name={partner2Name}
                      initialCost={row.cost}
                      editing={{
                        paymentId: payment.id,
                        amount: payment.amount,
                        payer: payment.payer,
                        payerLabel: payment.payerLabel,
                        paidOn: payment.paidOn,
                        note: payment.note,
                      }}
                      onCancel={() => setEditingPaymentId(null)}
                      onSaved={() => setEditingPaymentId(null)}
                    />
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="text-text">{fmt(payment.amount)}</span>
                      <span>
                        {payerDisplayName(
                          payment.payer,
                          payment.payerLabel,
                          { partner1Name, partner2Name },
                          payerLabels,
                        )}
                      </span>
                      {payment.paidOn ? (
                        <span>
                          {new Intl.DateTimeFormat(locale, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(payment.paidOn))}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setEditingPaymentId(payment.id)}
                        className="text-primary"
                      >
                        {t('editPayment')}
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleDelete(payment.id)}
                        className="text-red-600"
                      >
                        {t('deletePayment')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-sm text-red-600">{t('error')}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export function PaymentsView({ rows, locale, partner1Name, partner2Name }: PaymentsViewProps) {
  const t = useTranslations('Payments');
  const tPayer = useTranslations('Payer');
  const tCharts = useTranslations('Charts');
  const router = useRouter();
  const fmt = (n: number) => formatMoney(n, locale);

  const payerLabels: PayerLabels = {
    partner1: tPayer('partner1'),
    partner2: tPayer('partner2'),
    both: tPayer('both'),
    partner1Family: tPayer('partner1Family'),
    partner2Family: tPayer('partner2Family'),
    family: (name: string) => tPayer('family', { name }),
    other: tPayer('other'),
  };

  const totals = rollup(rows);

  const byPayerSlices = totals.byPayer
    .filter((entry) => entry.amount > 0)
    .map((entry) => ({
      label: payerDisplayName(entry.payer, entry.payerLabel, { partner1Name, partner2Name }, payerLabels),
      value: entry.amount,
      token: payerToken(entry.payer, entry.payerLabel),
    }));

  function handleChanged() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl text-text">{t('title')}</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('empty')}</p>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-3 rounded-card bg-surface p-4 shadow-sm">
            <div>
              <p className="text-xs text-muted">{t('totalsCost')}</p>
              <p className="text-lg text-text">{fmt(totals.totalCost)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('totalsPaid')}</p>
              <p className="text-lg text-text">{fmt(totals.totalPaid)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('totalsRemaining')}</p>
              <p className="text-lg text-text">{fmt(totals.totalRemaining)}</p>
            </div>
          </section>

          <div className="hidden gap-2 px-4 text-xs text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_8rem_6rem_6rem_6rem]">
            <span>{t('columnTask')}</span>
            <span>{t('columnVendor')}</span>
            <span className="text-end">{t('columnCost')}</span>
            <span className="text-end">{t('columnPaid')}</span>
            <span className="text-end">{t('columnRemaining')}</span>
          </div>

          <section className="flex flex-col gap-2">
            {rows.map((row) => (
              <PaymentTaskRow
                key={row.taskId}
                row={row}
                locale={locale}
                partner1Name={partner1Name}
                partner2Name={partner2Name}
                payerLabels={payerLabels}
                onChanged={handleChanged}
              />
            ))}
          </section>

          <section className="rounded-card bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-medium text-text">{t('byPayerTitle')}</h2>
            <DonutChart
              title={tCharts('byPayerTitle')}
              slices={byPayerSlices}
              sliceTitle={(s, p) =>
                tCharts('sliceTitle', { label: s.label, percent: Math.round(p * 100), amount: fmt(s.value) })
              }
              formatRow={(p) => tCharts('legendRow', { percent: Math.round(p * 100) })}
              formatAmount={fmt}
              emptyLabel={tCharts('empty')}
            />
            <ul className="mt-2 flex flex-col gap-1">
              {totals.byPayer.map((entry) => (
                <li
                  key={`${entry.payer}::${entry.payerLabel ?? ''}`}
                  className="flex items-center justify-between gap-2 text-sm text-text"
                >
                  <span>
                    {payerDisplayName(
                      entry.payer,
                      entry.payerLabel,
                      { partner1Name, partner2Name },
                      payerLabels,
                    )}
                  </span>
                  <span>{fmt(entry.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

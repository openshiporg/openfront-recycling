import Link from 'next/link';
import { Fragment } from 'react';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageHeader, Restricted, Section, pillClass } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn, humanize } from '@/features/platform/lib/format';
import { getApplication } from '../actions';
import { DecideApplication } from '../components/DecideApplication';
import { KIND_LABEL } from '../types';

type Props = { params: Promise<{ applicationId: string }> };

export async function ApplicationPage({ params }: Props) {
  const { applicationId } = await params;
  const [ctx, r] = await Promise.all([getStaffContext(), getApplication(applicationId)]);
  const name = r.ok ? r.application.businessName : 'Application';
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Accounts', href: '/dashboard/platform/accounts' }, { type: 'link' as const, label: 'Applications', href: '/dashboard/platform/accounts/applications' }, { type: 'page' as const, label: name }];
  const shell = (body: React.ReactNode) => <PageContainer title={name} breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!ctx.role.canManageAccounts) return shell(<Restricted>Reviewing applications needs the accounts permission.</Restricted>);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const a = r.application;
  const tz = ctx.yards[0]?.timezone;
  const materials = Array.isArray(a.materials) ? (a.materials as unknown[]).map(String) : typeof a.materials === 'string' ? [a.materials] : [];
  const rows: Array<[string, React.ReactNode]> = [
    ['Kind', KIND_LABEL[a.kind] || humanize(a.kind)], ['Legal name', a.legalName || '—'], ['Tax ID', a.taxId || '—'],
    ['Address', [a.addressLine1, a.addressLine2, [a.city, a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '—'],
    ['Phone', a.phone || '—'], ['Email', a.email || '—'], ['Applied by', a.applicant ? `${a.applicant.name} (${a.applicant.email})` : '—'],
    ['Materials', materials.length ? materials.join(', ') : '—'], ['Monthly volume', a.monthlyVolume || '—'], ['Containers', a.containerNeeds || '—'],
    ['Message', a.message || '—'], ['W-9', a.w9 ? <a className="underline underline-offset-4" href={a.w9.url} target="_blank" rel="noreferrer">{a.w9.filename}</a> : 'Not attached'],
  ];
  return shell(
    <>
      <PageHeader title={a.businessName} tone={a.status === 'submitted' ? 'wait' : a.status === 'approved' ? 'live' : 'off'} meta={<>{a.status === 'submitted' ? 'Waiting for a decision' : humanize(a.status)} · applied {dateTimeIn(a.createdAt, tz)}</>}
        actions={a.account ? <Link className={pillClass('raised')} href={`/dashboard/platform/accounts/${a.account.id}`}>Open account</Link> : null} />
      {a.status !== 'submitted' ? <Notice tone={a.status === 'approved' ? 'status' : 'alert'}>{humanize(a.status)}{a.decidedBy ? ` by ${a.decidedBy.name}` : ''}{a.decidedAt ? `, ${dateTimeIn(a.decidedAt, tz)}` : ''}{a.decisionReason ? `. ${a.decisionReason}` : '.'}</Notice> : null}
      <div className="grid gap-8 xl:grid-cols-[1fr_26rem]">
        <Section title="What they sent">
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">{rows.map(([k, v]) => <Fragment key={k}><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-pre-wrap">{v}</dd></Fragment>)}</dl>
        </Section>
        {a.status === 'submitted' ? <Section title="Decision"><DecideApplication application={a} priceLists={r.priceLists} /></Section> : null}
      </div>
    </>,
  );
}

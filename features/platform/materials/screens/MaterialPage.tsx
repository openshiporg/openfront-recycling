import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { Notice, PageHeader, Restricted, Section, Tag } from '@/features/platform/lib/ui';
import { getStaffContext } from '@/features/platform/lib/staff';
import { dateTimeIn } from '@/features/platform/lib/format';
import { getMaterial } from '../actions';
import { MaterialForm } from '../components/MaterialEditor';
import { MaterialImage } from '../components/MaterialImage';
import { Restrictions } from '../components/Restrictions';

type Props = { params: Promise<{ materialId: string }> };

export async function MaterialPage({ params }: Props) {
  const { materialId } = await params;
  const [ctx, r] = await Promise.all([getStaffContext(), getMaterial(materialId)]);
  const name = r.ok ? r.material.name : 'Material';
  const breadcrumbs = [{ type: 'link' as const, label: 'Dashboard', href: '/dashboard' }, { type: 'link' as const, label: 'Materials', href: '/dashboard/platform/materials' }, { type: 'page' as const, label: name }];
  const shell = (body: React.ReactNode) => <PageContainer title={name} breadcrumbs={breadcrumbs}><div className="flex flex-col gap-6 p-4 md:p-6">{body}</div></PageContainer>;
  if (!ctx.ok) return shell(<Notice tone="alert">{ctx.error}</Notice>);
  if (!r.ok) return shell(<Notice tone="alert">{r.error}</Notice>);
  const m = r.material;
  const canEdit = Boolean(ctx.role.canManageMaterials);
  const canRules = Boolean(ctx.role.canManageCompliance || ctx.role.canManageSettings);
  return shell(
    <>
      <PageHeader title={m.name} tone={m.isActive ? 'live' : 'off'} meta={<><Tag>{m.code}</Tag> {m.category?.name || 'No category'} · {m.direction === 'charge_customer' ? 'fee, customer pays' : 'yard pays'} · updated {dateTimeIn(m.updatedAt, ctx.yards[0]?.timezone)}</>} />
      <div className="grid gap-8 xl:grid-cols-[1fr_22rem]">
        <Section title="Details">{canEdit ? <MaterialForm material={m} categories={r.categories} /> : <Restricted>Editing needs the materials permission.</Restricted>}</Section>
        <Section title="Photo"><MaterialImage materialId={m.id} url={m.image?.url || null} canEdit={canEdit} /></Section>
      </div>
      <Section title="Rules for this material" count={r.restrictions.length}>
        <Restrictions materialId={m.id} restrictions={r.restrictions} profiles={r.profiles} canEdit={canRules} />
      </Section>
    </>,
  );
}

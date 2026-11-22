'use server';

import { revalidatePath } from 'next/cache';
import { platformRequest, platformUpload, trimmed, formImage } from '@/features/platform/lib/platformRequest';
import type { Category, MaterialDetail, MaterialRow, Profile, Restriction } from '../types';
import { CATEGORY_KINDS, UNITS } from '../types';

const PATH = '/dashboard/platform/materials';
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').replace(/#/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 80) || 'material';
const WEIGHT = /^\d{1,12}(\.\d{1,2})?$/;
const FIELDS = 'id name code slug specName defaultUnit direction isPublic isActive acceptsFromPublic sortOrder image { url } category { id name }';

function done<T>(r: { ok: true; data: T } | { ok: false; error: string }, id?: string) {
  if (!r.ok) return r;
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
  return { ok: true as const, data: r.data };
}

export async function getCatalog(input: { status: string; categoryId: string; q: string; page: number; perPage: number }) {
  const and: any[] = [];
  if (input.status === 'active') and.push({ isActive: { equals: true } });
  if (input.status === 'hidden') and.push({ isActive: { equals: true }, isPublic: { equals: false } });
  if (input.status === 'fees') and.push({ direction: { equals: 'charge_customer' } });
  if (input.status === 'inactive') and.push({ isActive: { equals: false } });
  if (input.categoryId) and.push({ category: { id: { equals: input.categoryId } } });
  const q = trimmed(input.q, 80);
  if (q) and.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }, { specName: { contains: q, mode: 'insensitive' } }] });
  const r = await platformRequest<{ materials: MaterialRow[]; materialsCount: number; categories: Category[]; active: number; hidden: number; fees: number; inactive: number; all: number }>(`
    query Catalog($where: MaterialWhereInput!, $take: Int!, $skip: Int!) {
      materials(where: $where, orderBy: [{ sortOrder: asc }, { name: asc }], take: $take, skip: $skip) { ${FIELDS} }
      materialsCount(where: $where)
      categories: materialCategories(orderBy: [{ sortOrder: asc }, { name: asc }]) { id name slug kind sortOrder materialsCount image { url } }
      all: materialsCount
      active: materialsCount(where: { isActive: { equals: true } })
      hidden: materialsCount(where: { isActive: { equals: true }, isPublic: { equals: false } })
      fees: materialsCount(where: { direction: { equals: "charge_customer" } })
      inactive: materialsCount(where: { isActive: { equals: false } })
    }`, { where: { AND: and }, take: input.perPage, skip: (input.page - 1) * input.perPage });
  return r.ok ? { ok: true as const, ...r.data } : r;
}

export async function getMaterial(id: string) {
  const r = await platformRequest<{ material: MaterialDetail | null; categories: Array<{ id: string; name: string }>; materialRestrictions: Restriction[]; rulesProfiles: Profile[] }>(`
    query MaterialDetail($id: ID!) {
      material(where: { id: $id }) { ${FIELDS} description preparationTips minimumWeight standardContainerTare updatedAt }
      categories: materialCategories(orderBy: [{ sortOrder: asc }, { name: asc }]) { id name }
      materialRestrictions(where: { OR: [{ material: { id: { equals: $id } } }, { category: { materials: { some: { id: { equals: $id } } } } }] }, orderBy: [{ label: asc }]) {
        id label kind forbidCash allowedMethods paymentHoldDays materialHoldDays mailCheckOnly publicNote requiredDocuments profile { id name } material { id } category { id name }
      }
      rulesProfiles(orderBy: [{ name: asc }]) { id name template region }
    }`, { id });
  if (!r.ok) return r;
  if (!r.data.material) return { ok: false as const, error: 'Material not found.' };
  return { ok: true as const, material: r.data.material, categories: r.data.categories, restrictions: r.data.materialRestrictions || [], profiles: r.data.rulesProfiles || [] };
}

type MaterialInput = {
  name: string; code: string; categoryId?: string; specName?: string; description?: string; preparationTips?: string; defaultUnit: string; direction: string;
  isPublic: boolean; isActive: boolean; acceptsFromPublic: boolean; sortOrder?: number; minimumWeight?: string; standardContainerTare?: string;
};

function materialData(input: MaterialInput, creating: boolean): { error: string } | Record<string, unknown> {
  const name = trimmed(input.name, 120);
  const code = trimmed(input.code, 30).toUpperCase();
  if (!name) return { error: 'Name the material.' };
  if (!code) return { error: 'Give the material a short code, such as CU-2.' };
  if (!(UNITS as readonly string[]).includes(input.defaultUnit)) return { error: 'Choose the unit it is priced in.' };
  if (!['pay_seller', 'charge_customer'].includes(input.direction)) return { error: 'Choose whether the yard pays for it or charges for it.' };
  for (const [label, v] of [['minimum weight', input.minimumWeight], ['container tare', input.standardContainerTare]] as const) {
    if (trimmed(v) && !WEIGHT.test(trimmed(v))) return { error: `Enter the ${label} as a number.` };
  }
  const data: Record<string, unknown> = {
    name, code, specName: trimmed(input.specName, 120), description: trimmed(input.description, 4000), preparationTips: trimmed(input.preparationTips, 4000),
    defaultUnit: input.defaultUnit, direction: input.direction, isPublic: Boolean(input.isPublic), isActive: Boolean(input.isActive), acceptsFromPublic: Boolean(input.acceptsFromPublic),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : 0,
    minimumWeight: trimmed(input.minimumWeight) || null, standardContainerTare: trimmed(input.standardContainerTare) || null,
  };
  if (input.categoryId) data.category = { connect: { id: input.categoryId } };
  else if (!creating) data.category = { disconnect: true };
  if (creating) data.slug = `${slugify(name)}-${slugify(code)}`;
  return data;
}

export async function createMaterialAction(input: MaterialInput) {
  const data = materialData(input, true);
  if ('error' in data) return { ok: false as const, error: String(data.error) };
  const r = await platformRequest<{ createMaterial: { id: string } }>(`mutation CreateMaterial($data: MaterialCreateInput!) { createMaterial(data: $data) { id } }`, { data });
  return done(r.ok ? { ok: true as const, data: r.data.createMaterial } : r);
}

export async function updateMaterialAction(id: string, input: MaterialInput) {
  const data = materialData(input, false);
  if ('error' in data) return { ok: false as const, error: String(data.error) };
  // These pages are force-dynamic. Return the saved record first; useCommand refreshes
  // them separately, so this response doesn't wait for a full page render.
  const r = await platformRequest<{ updateMaterial: MaterialDetail }>(`mutation UpdateMaterial($id: ID!, $data: MaterialUpdateInput!) { updateMaterial(where: { id: $id }, data: $data) { ${FIELDS} description preparationTips minimumWeight standardContainerTare updatedAt } }`, { id, data });
  return r.ok ? { ok: true as const, data: r.data.updateMaterial } : r;
}

export async function uploadMaterialImageAction(form: FormData) {
  const id = trimmed(form.get('materialId'), 64);
  const image = formImage(form, 'image');
  if (!id) return { ok: false as const, error: 'Material not found.' };
  if (!image) return { ok: false as const, error: 'Choose a photo.' };
  if ('error' in image) return { ok: false as const, error: image.error };
  return done(await platformUpload(`mutation MaterialImage($id: ID!, $data: MaterialUpdateInput!) { updateMaterial(where: { id: $id }, data: $data) { id image { url } } }`, { id, data: { image: { upload: null } } }, { 'data.image.upload': image }), id);
}

export async function saveCategoryAction(input: { id?: string; name: string; kind: string; sortOrder?: number }) {
  const name = trimmed(input.name, 80);
  if (!name) return { ok: false as const, error: 'Name the category.' };
  if (!(CATEGORY_KINDS as readonly string[]).includes(input.kind)) return { ok: false as const, error: 'Choose the kind of material.' };
  const data: Record<string, unknown> = { name, kind: input.kind, sortOrder: Math.trunc(Number(input.sortOrder) || 0) };
  if (input.id) return done(await platformRequest(`mutation UpdateCategory($id: ID!, $data: MaterialCategoryUpdateInput!) { updateMaterialCategory(where: { id: $id }, data: $data) { id } }`, { id: input.id, data }));
  data.slug = slugify(name);
  return done(await platformRequest(`mutation CreateCategory($data: MaterialCategoryCreateInput!) { createMaterialCategory(data: $data) { id } }`, { data }));
}

export async function addRestrictionAction(input: { materialId: string; profileId: string; label: string; kind: string; forbidCash: boolean; mailCheckOnly: boolean; paymentHoldDays: number; materialHoldDays: number; publicNote?: string; requiredDocuments?: string }) {
  const label = trimmed(input.label, 120);
  if (!input.profileId) return { ok: false as const, error: 'Choose the rules profile.' };
  if (!label) return { ok: false as const, error: 'Describe the rule in a few words.' };
  if (!['prohibited', 'proof_of_ownership', 'commercial_only', 'payment_rule'].includes(input.kind)) return { ok: false as const, error: 'Choose the kind of rule.' };
  const days = (v: number) => Math.max(0, Math.min(365, Math.trunc(Number(v) || 0)));
  const docs = trimmed(input.requiredDocuments, 400).split(',').map((s) => s.trim()).filter(Boolean);
  const data = {
    profile: { connect: { id: input.profileId } }, material: { connect: { id: input.materialId } }, label, kind: input.kind,
    forbidCash: Boolean(input.forbidCash), mailCheckOnly: Boolean(input.mailCheckOnly), paymentHoldDays: days(input.paymentHoldDays), materialHoldDays: days(input.materialHoldDays),
    publicNote: trimmed(input.publicNote, 1000), requiredDocuments: docs,
  };
  return done(await platformRequest(`mutation AddRestriction($data: MaterialRestrictionCreateInput!) { createMaterialRestriction(data: $data) { id } }`, { data }), input.materialId);
}

export async function removeRestrictionAction(input: { id: string; materialId: string }) {
  // The client removes only the ID confirmed by the mutation, then refreshes.
  return platformRequest<{ deleteMaterialRestriction: { id: string } | null }>(`mutation RemoveRestriction($id: ID!) { deleteMaterialRestriction(where: { id: $id }) { id } }`, { id: input.id });
}

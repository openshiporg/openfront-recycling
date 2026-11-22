import { platformRequest } from './platformRequest';

export type YardChoice = { id: string; name: string; code: string; timezone: string | null };
export type StaffContext =
  | { ok: true; user: { id: string; name: string }; role: Record<string, boolean>; yards: YardChoice[] }
  | { ok: false; error: string };

const FLAGS = 'canManageTickets canGradeTickets canPaySellers canManageCashDrawers canVoidTickets canApproveVariances canOverridePrices canManageSettings canManageSellers canManageFinance canManagePricing canManageMaterials canManageAccounts canManageInventory canManageSales canManageDispatch canDriveJobs canManageCompliance canViewReports canManageStaff canManageOnboarding';

/** The signed-in staff member, their role flags and the yards they work at (all active yards for a settings manager). */
export async function getStaffContext(): Promise<StaffContext> {
  const r = await platformRequest<{ authenticatedItem: any; yards: YardChoice[] }>(`
    query StaffContext {
      authenticatedItem { ... on User { id name role { ${FLAGS} } yards(orderBy: [{ name: asc }]) { id name code timezone } } }
      yards(where: { status: { equals: "active" } }, orderBy: [{ name: asc }]) { id name code timezone }
    }`);
  if (!r.ok) return { ok: false, error: r.error };
  const user = r.data.authenticatedItem;
  if (!user) return { ok: false, error: 'Sign in to continue.' };
  const role = (user.role || {}) as Record<string, boolean>;
  return { ok: true, user: { id: user.id, name: user.name }, role, yards: role.canManageSettings ? r.data.yards : user.yards || [] };
}

/** The yard picked with ?yard= (id or code), else the first yard the staff member works at. */
export function pickYard(yards: YardChoice[], wanted: unknown) {
  const w = typeof wanted === 'string' ? wanted : '';
  return yards.find((y) => y.id === w || y.code === w) || yards[0] || null;
}

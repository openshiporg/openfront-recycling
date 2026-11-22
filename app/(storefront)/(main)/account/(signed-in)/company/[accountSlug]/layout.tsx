import type { ReactNode } from 'react';
import { CompanyFrame } from '@/features/storefront/screens/company/CompanyPages';
export default async function Layout({ children, params }: { children: ReactNode; params: Promise<{ accountSlug: string }> }) {
  const { accountSlug } = await params;
  return <CompanyFrame slug={accountSlug}>{children}</CompanyFrame>;
}

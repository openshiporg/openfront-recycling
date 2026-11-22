'use client';

import { Printer } from 'lucide-react';
import { Pill } from '@/features/platform/lib/ui';

export function PrintButton() {
  return <Pill variant="primary" onClick={() => window.print()}><Printer />Print</Pill>;
}

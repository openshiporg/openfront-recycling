export type ActionResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

export type DrawerEvent = { id: string; kind: string; amountCents: number; note: string | null; payoutId: string | null; ticketId: string | null; createdAt: string };
export type DrawerSession = {
  id: string; status: 'open' | 'counting' | string; cashierId: string | null; cashierName: string | null; isMine: boolean;
  openingFloatCents: number; expectedCents: number; countedCents: number | null; varianceCents: number | null; openedAt: string | null;
  totals: Array<{ kind: string; count: number; amountCents: number }>; events: DrawerEvent[];
};
export type DrawerRow = {
  drawerId: string; name: string; session: DrawerSession | null;
  lastClosed: { id: string; closedAt: string | null; cashierName: string | null; countedCents: number | null; varianceCents: number | null; approvedByName: string | null } | null;
};
export type DrawerState = { yardId: string; drawers: DrawerRow[]; pendingApproval: number };

export type QueuePayout = {
  id: string; amountCents: number; status: string; allowedMethods: string[] | null; releaseAt: string | null; returnReason: string | null; createdAt: string;
  mailToAddress: string | null;
  ticket: { id: string; displayNumber: string; completedAt: string | null } | null;
  seller: { id: string; firstName: string; lastName: string; preferredPayout: string | null } | null;
  account: { id: string; name: string } | null;
  replaces: { id: string; checkNumber: string | null; transferReference: string | null } | null;
};

export type RegisterRow = {
  id: string; amountCents: number; status: string; method: string | null; checkNumber: string | null; bankAccountLabel: string | null; transferReference: string | null;
  paidAt: string | null; returnReason: string | null; paidBy: { name: string } | null;
  ticket: { id: string; displayNumber: string } | null; seller: { firstName: string; lastName: string } | null; account: { name: string } | null;
};

export type CollectRow = {
  id: string; number: number | null; status: string; totalCents: number; paidCents: number; dueOn: string | null; createdAt: string;
  ticket: { id: string; displayNumber: string } | null; sellerName: string | null; accountName: string | null;
};

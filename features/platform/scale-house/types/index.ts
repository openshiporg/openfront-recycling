export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type ComplianceItem = { code: string; message: string; lineId: string | null; overridable: boolean };

export type YardChoice = { id: string; name: string; code: string; timezone: string | null };

export type VisitCard = { visitId: string; code: string | null; status: string; sellerId: string | null; sellerName: string | null; plannedDate: string | null; vehiclePlate: string | null; expectedItems: string[] };

export type TicketCard = {
  ticketId: string; number: string; direction: string; sellerId: string | null; sellerName: string | null; accountId: string | null; accountName: string | null;
  vehiclePlate: string | null; lineCount: number; totalCents: number; payWeight: string; openedAt: string; minutesOpen: number; missing: ComplianceItem[];
};

export type PayoutCard = { payoutId: string; ticketId: string | null; number: string | null; sellerName: string | null; accountName: string | null; amountCents: number; status: string; releaseAt: string | null; allowedMethods: string[]; completedAt: string | null };

export type Board = { yardId: string; yardName: string; generatedAt: string; checkedIn: VisitCard[]; weighing: TicketCard[]; readyToComplete: TicketCard[]; readyToPay: PayoutCard[] };

export type SellerHit = {
  id: string; name: string; phone: string | null; city: string | null; status: string; idVerification: string; matchedOn: string[];
  idKind: string | null; idLast4: string | null; idExpiresOn: string | null; plates: string[]; lastTicketAt: string | null; ticketCount: number;
};

export type ScaleChoice = { id: string; name: string; kind: string; lastReadingWeight: string | null; lastReadingAt: string | null; lastReadingStable: boolean | null };
export type MaterialChoice = { id: string; name: string; code: string | null; defaultUnit: string; direction: string; category: { name: string } | null };

export type TicketLineRow = {
  id: string; sortOrder: number; materialName: string; direction: string; grossWeight: string | null; tareWeight: string | null; netWeight: string | null;
  deductionWeight: string | null; deductionPercent: string | null; deductionReason: string | null; payWeight: string | null; quantity: number | null; unit: string | null;
  unitPrice: string | null; priceSource: string | null; overrideReason: string | null; amountCents: number | null; material: { id: string; name: string; code: string | null; defaultUnit: string } | null;
};

export type TicketDetail = {
  id: string; displayNumber: string; direction: string; status: string; paymentMode: string; isAdjustment: boolean;
  vehiclePlate: string | null; vehiclePlateRegion: string | null; vehicleDescription: string | null; notes: string | null; overrideReason: string | null;
  materialTotalCents: number | null; feeTotalCents: number | null; taxCents: number | null; totalCents: number | null; donatePercent: number | null;
  completedAt: string | null; voidedAt: string | null; voidReason: string | null; createdAt: string; fees: Array<{ label: string; amountCents: number }> | null;
  yard: YardChoice | null;
  seller: { id: string; firstName: string; lastName: string; status: string; idVerification: string; phone: string | null } | null;
  account: { id: string; name: string; accountNumber: string | null } | null;
  vehicle: { id: string; plate: string; plateRegion: string | null } | null;
  openedBy: { name: string } | null; completedBy: { name: string } | null;
  lines: TicketLineRow[];
  weighEvents: Array<{ id: string; kind: string; weight: string; captureMethod: string; capturedAt: string; scale: { name: string } | null; line: { id: string } | null }>;
  attachments: Array<{ id: string; kind: string; signedName: string | null; capturedAt: string; line: { id: string } | null; image: { url: string; width: number; height: number } | null }>;
  payouts: Array<{ id: string; amountCents: number; status: string; method: string | null; releaseAt: string | null; allowedMethods: string[] | null; paidAt: string | null }>;
  checklist: ComplianceItem[];
};

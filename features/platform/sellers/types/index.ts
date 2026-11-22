export type SellerHit = {
  id: string; name: string; phone: string | null; email: string | null; city: string | null; status: string; idVerification: string; matchedOn: string[];
  idKind: string | null; idLast4: string | null; idExpiresOn: string | null; plates: string[]; lastTicketAt: string | null; ticketCount: number;
};
export type SellerRow = {
  id: string; firstName: string; lastName: string; phone: string | null; email: string | null; city: string | null; region: string | null; status: string; idVerification: string;
  createdAt: string; ticketsCount: number; vehicles: Array<{ plate: string | null }>;
};
export type IdDoc = { id: string; kind: string; number: string; issuer: string | null; expiresOn: string | null; isCurrent: boolean; verifiedAt: string | null; verifiedBy: { name: string } | null; frontImage: { url: string } | null; backImage: { url: string } | null; createdAt: string };
export type Vehicle = { id: string; plate: string | null; plateRegion: string | null; make: string | null; model: string | null; color: string | null; kind: string; storedTare: string | null; isRemoved: boolean };
export type SellerTicket = { id: string; displayNumber: string | null; status: string; direction: string; totalCents: number | null; completedAt: string | null; createdAt: string; yard: { name: string; timezone: string } | null };
export type SellerPayout = { id: string; amountCents: number; status: string; method: string | null; paidAt: string | null; releaseAt: string | null; checkNumber: string | null; createdAt: string; ticket: { id: string; displayNumber: string | null } | null };
export type DoNotBuy = { id: string; reason: string | null; source: string | null; expiresOn: string | null; isActive: boolean; createdAt: string };
export type SellerDetail = {
  id: string; firstName: string; lastName: string; dateOfBirth: string | null; phone: string | null; email: string | null;
  addressLine1: string | null; addressLine2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null;
  status: string; statusReason: string | null; idVerification: string; preferredPayout: string; notes: string | null; createdAt: string;
  priceList: { id: string; name: string } | null; user: { id: string } | null;
  identityDocuments: IdDoc[]; vehicles: Vehicle[]; tickets: SellerTicket[]; ticketsCount: number;
};
export const ID_KINDS: Record<string, string> = { drivers_license: 'Driver’s licence', state_id: 'State ID', passport: 'Passport', military_id: 'Military ID', other: 'Other ID' };
export const VEHICLE_KINDS = ['car', 'pickup', 'box_truck', 'trailer', 'roll_off', 'semi', 'other'] as const;
export const SELLER_STATUS: Record<string, string> = { active: 'Active', flagged: 'Flagged', do_not_buy: 'Do not buy' };

/**
 * Ticket compliance (dissertation §4.9). Pure: no database access, so it is tested directly and the
 * ticket screen can show the same checklist the server enforces. The yard's owner sets the rules
 * profile; this code records and enforces what the profile requires.
 */

export type RulesProfileInput = {
  requireGovernmentId: boolean
  requireIdPhoto: boolean
  requireSellerPhoto: boolean
  requireMaterialPhoto: boolean
  requireVehiclePlate: boolean
  requireSignature: boolean
  requireThumbprint: boolean
  minimumSellerAge: number
  cashLimitPerTicketCents?: number | null
  cashLimitPerDayCents?: number | null
  cashRounding?: string | null
  defaultPaymentHoldDays?: number | null
  defaultMaterialHoldDays?: number | null
}

export type RestrictionInput = {
  id: string
  label: string
  materialId?: string | null
  categoryId?: string | null
  kind: 'prohibited' | 'proof_of_ownership' | 'commercial_only' | 'payment_rule' | string
  requiredDocuments?: string[] | null
  forbidCash?: boolean | null
  allowedMethods?: string[] | null
  paymentHoldDays?: number | null
  materialHoldDays?: number | null
  mailCheckOnly?: boolean | null
}

export type ComplianceTicketInput = {
  direction: 'inbound' | 'outbound' | string
  isCommercial: boolean
  isAdjustment?: boolean
  now?: Date
  seller?: {
    status: string
    dateOfBirth?: Date | string | null
    doNotBuyMatch?: boolean
  } | null
  identity?: {
    expiresOn?: Date | string | null
    hasFrontImage: boolean
    hasThumbprint?: boolean
  } | null
  vehiclePlate?: string | null
  attachments: Array<{ kind: string; lineId?: string | null }>
  lines: Array<{
    id: string
    materialId?: string | null
    categoryId?: string | null
    materialName?: string
    hasPrice: boolean
    documents?: string[] | null
  }>
}

export type MissingItem = { code: string; message: string; lineId?: string; overridable: boolean }

function ageOn(dob: Date, now: Date) {
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const m = now.getUTCMonth() - dob.getUTCMonth()
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1
  return age
}

export function restrictionsForLine(line: { materialId?: string | null; categoryId?: string | null }, restrictions: RestrictionInput[]) {
  return restrictions.filter((r) => (r.materialId && r.materialId === line.materialId) || (!r.materialId && r.categoryId && r.categoryId === line.categoryId))
}

/**
 * Screening at check-in (§4.1 step 2). `do_not_buy` is never overridable.
 */
export function screenSeller(input: { seller: ComplianceTicketInput['seller']; identity: ComplianceTicketInput['identity']; profile: RulesProfileInput; isCommercial: boolean; now?: Date }): MissingItem[] {
  const now = input.now || new Date()
  const out: MissingItem[] = []
  const { seller, identity, profile } = input
  if (input.isCommercial) return out
  if (!seller) {
    out.push({ code: 'seller_required', message: 'A seller is needed for a retail ticket.', overridable: false })
    return out
  }
  if (seller.status === 'do_not_buy') out.push({ code: 'do_not_buy', message: 'This seller is on the do-not-buy list. The yard cannot buy from them.', overridable: false })
  if (seller.doNotBuyMatch) out.push({ code: 'do_not_buy_list', message: 'This seller matches an entry on the do-not-buy list.', overridable: false })
  if (profile.minimumSellerAge > 0) {
    if (!seller.dateOfBirth) out.push({ code: 'date_of_birth', message: 'Date of birth is needed to check the minimum age.', overridable: true })
    else if (ageOn(new Date(seller.dateOfBirth), now) < profile.minimumSellerAge) out.push({ code: 'minimum_age', message: `The seller must be at least ${profile.minimumSellerAge}.`, overridable: false })
  }
  if (profile.requireGovernmentId) {
    if (!identity) out.push({ code: 'government_id', message: 'A government ID must be on file.', overridable: true })
    else if (identity.expiresOn && new Date(identity.expiresOn).getTime() < now.getTime()) out.push({ code: 'id_expired', message: 'The ID on file has expired.', overridable: true })
  }
  return out
}

/**
 * The checklist at completion (§4.1 step 7, §4.9.1). Returns every missing item; the ticket can
 * complete only when the list is empty (an overridable item counts as satisfied once a manager has
 * recorded an override with a reason; `do_not_buy` and prohibited materials never are).
 */
export function validateTicketCompliance(ticket: ComplianceTicketInput, profile: RulesProfileInput, restrictions: RestrictionInput[]): MissingItem[] {
  const out: MissingItem[] = []
  const now = ticket.now || new Date()
  if (!ticket.lines.length) out.push({ code: 'no_lines', message: 'Add at least one line.', overridable: false })
  for (const line of ticket.lines) {
    if (!line.materialId) out.push({ code: 'line_material', message: 'Every line needs a material.', lineId: line.id, overridable: false })
    if (!line.hasPrice) out.push({ code: 'line_price', message: `${line.materialName || 'A line'} has no price.`, lineId: line.id, overridable: false })
  }
  if (ticket.direction !== 'inbound' || ticket.isAdjustment) return out

  if (!ticket.isCommercial) {
    out.push(...screenSeller({ seller: ticket.seller, identity: ticket.identity, profile, isCommercial: false, now }))
    if (profile.requireIdPhoto && ticket.identity && !ticket.identity.hasFrontImage) out.push({ code: 'id_photo', message: 'A photo of the ID is needed.', overridable: true })
    const kinds = new Set(ticket.attachments.map((a) => a.kind))
    if (profile.requireSellerPhoto && !kinds.has('seller_photo')) out.push({ code: 'seller_photo', message: 'Take a photo of the seller.', overridable: true })
    if (profile.requireMaterialPhoto && !kinds.has('material_photo')) out.push({ code: 'material_photo', message: 'Take a photo of the material.', overridable: true })
    if (profile.requireVehiclePlate && !String(ticket.vehiclePlate || '').trim()) out.push({ code: 'vehicle_plate', message: 'Record the vehicle plate.', overridable: true })
    if (profile.requireSignature && !kinds.has('signature')) out.push({ code: 'signature', message: 'The seller must sign the ownership statement.', overridable: true })
    if (profile.requireThumbprint && !kinds.has('thumbprint') && !ticket.identity?.hasThumbprint) out.push({ code: 'thumbprint', message: 'A thumbprint image is needed.', overridable: true })
  }

  for (const line of ticket.lines) {
    for (const r of restrictionsForLine(line, restrictions)) {
      if (r.kind === 'prohibited') out.push({ code: 'prohibited', message: `${r.label}: the yard does not buy this material.`, lineId: line.id, overridable: false })
      if (r.kind === 'commercial_only' && !ticket.isCommercial) out.push({ code: 'commercial_only', message: `${r.label}: only bought from commercial accounts.`, lineId: line.id, overridable: false })
      const needed = (r.requiredDocuments || []).filter(Boolean)
      if (r.kind === 'proof_of_ownership' && !needed.length) needed.push('proof_of_ownership')
      const have = new Set([...(line.documents || []), ...ticket.attachments.filter((a) => a.kind === 'ownership_document' && (!a.lineId || a.lineId === line.id)).map(() => 'proof_of_ownership')])
      for (const doc of needed) {
        if (!have.has(doc) && !(doc !== 'proof_of_ownership' && (line.documents || []).includes(doc))) {
          out.push({ code: `document_${doc}`, message: `${r.label}: ${doc.replace(/_/g, ' ')} is needed.`, lineId: line.id, overridable: false })
        }
      }
    }
  }
  return out
}

export function blockingItems(items: MissingItem[], override: { reason?: string | null } | null) {
  if (override?.reason && override.reason.trim().length >= 3) return items.filter((i) => !i.overridable)
  return items
}

export type PayoutGroup = { lineIds: string[]; amountCents: number; allowedMethods: string[]; releaseAt: Date | null; mailCheckOnly: boolean }

/**
 * §4.9.3 Payout split: lines grouped by (allowed methods, release time). Fee lines (negative)
 * reduce the first unrestricted group, never a held one.
 */
export function splitPayouts(input: {
  lines: Array<{ id: string; signedAmountCents: number; materialId?: string | null; categoryId?: string | null }>
  restrictions: RestrictionInput[]
  yardMethods: string[]
  profile: RulesProfileInput
  completedAt: Date
  extraCents?: number
}): PayoutGroup[] {
  const base = input.yardMethods.length ? input.yardMethods : ['cash', 'check', 'transfer']
  const groups = new Map<string, PayoutGroup>()
  const defaultHold = Number(input.profile.defaultPaymentHoldDays || 0)
  let adjust = Number(input.extraCents || 0)
  for (const line of input.lines) {
    if (line.signedAmountCents <= 0) {
      adjust += line.signedAmountCents
      continue
    }
    let methods = [...base]
    let holdDays = defaultHold
    let mailCheckOnly = false
    for (const r of restrictionsForLine(line, input.restrictions)) {
      if (r.forbidCash) methods = methods.filter((m) => m !== 'cash')
      if (r.allowedMethods?.length) methods = methods.filter((m) => r.allowedMethods!.includes(m))
      if (r.mailCheckOnly) { mailCheckOnly = true; methods = methods.filter((m) => m === 'check' || m === 'transfer') }
      holdDays = Math.max(holdDays, Number(r.paymentHoldDays || 0))
    }
    methods.sort()
    const releaseAt = holdDays > 0 ? new Date(input.completedAt.getTime() + holdDays * 86_400_000) : null
    const key = `${methods.join(',')}|${releaseAt ? releaseAt.toISOString() : 'now'}|${mailCheckOnly}`
    const group = groups.get(key) || { lineIds: [], amountCents: 0, allowedMethods: methods, releaseAt, mailCheckOnly }
    group.lineIds.push(line.id)
    group.amountCents += line.signedAmountCents
    groups.set(key, group)
  }
  const list = [...groups.values()].sort((a, b) => (a.releaseAt?.getTime() || 0) - (b.releaseAt?.getTime() || 0) || b.allowedMethods.length - a.allowedMethods.length)
  // Charges and fees come off the payouts in order: the unrestricted, payable-now one first.
  for (const group of list) {
    if (adjust >= 0) break
    const take = Math.min(group.amountCents, -adjust)
    group.amountCents -= take
    adjust += take
  }
  if (adjust > 0 && list.length) list[0].amountCents += adjust
  return list.filter((g) => g.amountCents > 0)
}

/** Templates (§4.9 table). Every value is editable; the owner must confirm local rules. */
export const RULE_TEMPLATES = {
  general: {
    name: 'General rules',
    profile: {
      requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: false, requireMaterialPhoto: true, requireVehiclePlate: true,
      requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashLimitPerTicketCents: null, cashLimitPerDayCents: null,
      cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 730,
      dailyReport: false, reportDueTime: '', reportOmitsPrice: false,
    },
    restrictions: [
      { label: 'Catalytic converters', materialCode: 'CATS', kind: 'proof_of_ownership', requiredDocuments: ['proof_of_ownership'], forbidCash: false, paymentHoldDays: 0, publicNote: 'Bring a title, repair invoice or other proof that the converter is yours.' },
    ],
  },
  ohio: {
    name: 'Ohio rules',
    profile: {
      requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: true, requireMaterialPhoto: true, requireVehiclePlate: true,
      requireSignature: true, requireThumbprint: false, minimumSellerAge: 18, cashLimitPerTicketCents: null, cashLimitPerDayCents: null,
      cashRounding: 'none', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 365,
      dailyReport: true, reportDueTime: '12:00', reportOmitsPrice: false,
    },
    restrictions: [
      { label: 'Special purchase articles', categoryKind: 'special_purchase', materialCodes: ['INSW-H', 'INSW-M', 'INSW-L', 'BURNT'], kind: 'payment_rule', forbidCash: true, paymentHoldDays: 2, publicNote: 'Special purchase articles (such as burnt wire) are paid by check or transfer, two days after the sale.' },
      { label: 'Catalytic converters', materialCode: 'CATS', kind: 'proof_of_ownership', requiredDocuments: ['proof_of_ownership'], forbidCash: true, paymentHoldDays: 0, publicNote: 'Catalytic converters need proof of ownership and are not paid in cash.' },
    ],
  },
  florida: {
    name: 'Florida rules',
    profile: {
      requireGovernmentId: true, requireIdPhoto: true, requireSellerPhoto: true, requireMaterialPhoto: true, requireVehiclePlate: true,
      requireSignature: true, requireThumbprint: true, minimumSellerAge: 18, cashLimitPerTicketCents: 100_000, cashLimitPerDayCents: null,
      cashRounding: 'nickel_up', defaultPaymentHoldDays: 0, defaultMaterialHoldDays: 0, allowEarlyRelease: false, retentionDays: 1095,
      dailyReport: true, reportDueTime: '10:00', reportOmitsPrice: true,
    },
    restrictions: [
      { label: 'Restricted regulated metals', materialCodes: ['CATS', 'INSW-H', 'INSW-M', 'INSW-L', 'BURNT', 'CU-BB', 'CU-1', 'CU-2'], kind: 'payment_rule', forbidCash: true, mailCheckOnly: true, paymentHoldDays: 3, publicNote: 'Restricted regulated metals are not paid in cash at any amount; payment is by mailed check or transfer after three days.' },
    ],
  },
} as const

export type RulesTemplateKey = keyof typeof RULE_TEMPLATES

import { Decimal } from 'decimal.js'

/**
 * Scale ticket line maths (dissertation §5.1). Pure: shared by the server commands and the
 * storefront scrap calculator, so both round the same way. Weights and prices are Decimal, never floats.
 */

export type WeightUnitBase = 'lb' | 'kg'
export type PriceUnit = 'lb' | 'cwt' | 'net_ton' | 'gross_ton' | 'kg' | 'metric_tonne' | 'each'
export type LineDirection = 'pay_seller' | 'charge_customer'

const LB_FACTORS: Record<string, number> = { lb: 1, cwt: 100, net_ton: 2000, gross_ton: 2240, each: 1 }
const KG_FACTORS: Record<string, number> = { kg: 1, metric_tonne: 1000, each: 1 }

export class TicketMathError extends Error {}

export function unitFactor(unit: string, base: WeightUnitBase = 'lb'): number {
  const factor = (base === 'kg' ? KG_FACTORS : LB_FACTORS)[unit]
  if (!factor) throw new TicketMathError(`The unit "${unit}" cannot be used when weights are kept in ${base}.`)
  return factor
}

export function unitsFor(base: WeightUnitBase): PriceUnit[] {
  return Object.keys(base === 'kg' ? KG_FACTORS : LB_FACTORS) as PriceUnit[]
}

type Num = Decimal | string | number | null | undefined

export function dec(value: Num): Decimal {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  if (Decimal.isDecimal(value)) return value as Decimal
  return new Decimal(String(value))
}

export type LineInput = {
  grossWeight?: Num
  tareWeight?: Num
  deductionWeight?: Num
  deductionPercent?: Num
  quantity?: number | null
  unit: string
  unitPrice: Num
  direction: LineDirection | string
}

export type LineResult = {
  netWeight: Decimal
  deduction: Decimal
  payWeight: Decimal
  amountCents: number
  signedAmountCents: number
}

/** Rounds half up to whole cents (§5.1 roundHalfUp). */
export function roundCents(value: Decimal): number {
  const sign = value.isNegative() ? -1 : 1
  return sign * value.abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

export function computeLine(line: LineInput, base: WeightUnitBase = 'lb'): LineResult {
  const factor = unitFactor(line.unit, base)
  const price = dec(line.unitPrice)
  if (price.isNegative()) throw new TicketMathError('A unit price cannot be negative; use a charge material instead.')

  if (line.unit === 'each') {
    const quantity = Number(line.quantity ?? 0)
    if (!Number.isInteger(quantity) || quantity <= 0) throw new TicketMathError('An item priced each needs a whole quantity above zero.')
    const gross = dec(line.grossWeight)
    const tare = dec(line.tareWeight)
    const net = gross.gt(0) ? gross.minus(tare) : new Decimal(0)
    const amount = roundCents(price.times(quantity).times(100))
    const signed = line.direction === 'charge_customer' ? -amount : amount
    return { netWeight: net.toDecimalPlaces(2), deduction: new Decimal(0), payWeight: new Decimal(quantity), amountCents: amount, signedAmountCents: signed }
  }

  const gross = dec(line.grossWeight)
  const tare = dec(line.tareWeight)
  const net = gross.minus(tare)
  if (!net.gt(0)) throw new TicketMathError('Gross weight must be more than tare weight.')

  let deduction: Decimal
  if (line.deductionWeight !== null && line.deductionWeight !== undefined && line.deductionWeight !== '') {
    deduction = dec(line.deductionWeight)
  } else if (line.deductionPercent !== null && line.deductionPercent !== undefined && line.deductionPercent !== '') {
    const pct = dec(line.deductionPercent)
    if (pct.isNegative() || pct.gt(100)) throw new TicketMathError('A deduction percent must be between 0 and 100.')
    deduction = net.times(pct).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  } else {
    deduction = new Decimal(0)
  }
  if (deduction.isNegative()) throw new TicketMathError('A deduction cannot be negative.')
  const payWeight = net.minus(deduction)
  if (payWeight.isNegative()) throw new TicketMathError('The deduction is larger than the net weight.')

  const amount = roundCents(payWeight.times(price).div(factor).times(100))
  const signed = line.direction === 'charge_customer' ? -amount : amount
  return { netWeight: net.toDecimalPlaces(2), deduction: deduction.toDecimalPlaces(2), payWeight: payWeight.toDecimalPlaces(2), amountCents: amount, signedAmountCents: signed }
}

/** unitPrice is in dollars per unit (decimal 14,5); amounts are cents. */
export type TicketFee = { label: string; amountCents: number }

export function computeTicketTotals(lines: Array<{ signedAmountCents: number }>, fees: TicketFee[] = [], feeTaxRatePercent: Num = 0) {
  const materialTotalCents = lines.reduce((sum, line) => sum + line.signedAmountCents, 0)
  const feeTotalCents = fees.reduce((sum, fee) => sum + Math.trunc(Number(fee.amountCents) || 0), 0)
  const chargeBase = lines.filter((l) => l.signedAmountCents < 0).reduce((s, l) => s - l.signedAmountCents, 0) + fees.filter((f) => f.amountCents < 0).reduce((s, f) => s - f.amountCents, 0)
  const taxCents = roundCents(new Decimal(chargeBase).times(dec(feeTaxRatePercent)).div(100))
  return { materialTotalCents, feeTotalCents, taxCents, totalCents: materialTotalCents + feeTotalCents - taxCents }
}

/** Florida-style rounding of a cash payout up to the next nickel. */
export function roundCashUpToNickel(cents: number) {
  return Math.ceil(cents / 5) * 5
}

/** Truck-scale (sequential) weighing: W0 full, then one weight after each unload. */
export function sequentialLineWeights(weights: Num[]) {
  if (weights.length < 2) throw new TicketMathError('Truck-scale weighing needs a full weight and at least one weight after unloading.')
  const values = weights.map(dec)
  const out: Array<{ gross: Decimal; tare: Decimal }> = []
  for (let i = 1; i < values.length; i += 1) {
    if (!values[i - 1].gt(values[i])) throw new TicketMathError(`Weight ${i + 1} must be lower than the weight before it.`)
    out.push({ gross: values[i - 1], tare: values[i] })
  }
  return out
}

/** Scrap calculator helper for the storefront: an estimate at a board price. */
export function estimateValueCents(weight: Num, unitPrice: Num, unit: string, base: WeightUnitBase = 'lb') {
  return roundCents(dec(weight).times(dec(unitPrice)).div(unitFactor(unit, base)).times(100))
}

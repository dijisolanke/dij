/** Stripe's smallest allowed charge per currency. Lower prices fail at checkout. */
const STRIPE_MINIMUM: Record<string, number> = {gbp: 0.3, usd: 0.5, eur: 0.5}

const SYMBOL: Record<string, string> = {gbp: '£', usd: '$', eur: '€'}

export function minPriceCheck(price: unknown, currency = 'gbp'): true | string {
  if (typeof price !== 'number') return true // "required" handles empty
  const min = STRIPE_MINIMUM[currency] ?? 0.5
  return price >= min || `Payments must be at least ${SYMBOL[currency] ?? ''}${min.toFixed(2)} (Stripe's minimum)`
}

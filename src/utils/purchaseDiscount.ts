// Configuration et calcul des remises fournisseurs par paliers + transport.
// Partagé entre SuppliersPage (config) et PurchasesPage (application).

export type DiscountType = 'centime' | 'dirham' | 'percent'
export type DiscountBasis = 'kilo' | 'boite'

export interface DiscountTier {
  min_qty: number          // seuil en unité de base (kg) du cumul mensuel fournisseur
  type: DiscountType       // centime = value/100 dh, dirham = value dh, percent = value %
  value: number
  basis: DiscountBasis     // kilo = réduction par kg ; boite = réduction par boîte (carton/paquet/sac)
}

export interface SupplierPurchaseConfig {
  transport_rate?: number  // dh par kg (0 = pas de transport)
  discount_tiers?: DiscountTier[]
}

// Une ligne d'achat minimale pour le calcul de la remise.
export interface DiscountableLine {
  line_total: number
  quantity: number
  base_quantity?: number
  unit_type?: string
}

const BOITE_UNITS = new Set(['carton', 'paquet', 'sac'])

export function parsePurchaseConfig(raw: any): SupplierPurchaseConfig {
  if (!raw || typeof raw !== 'object') return { transport_rate: 0, discount_tiers: [] }
  const rawTiers = Array.isArray(raw.discount_tiers) ? raw.discount_tiers : []
  const discount_tiers: DiscountTier[] = rawTiers
    .map((t: any): DiscountTier => ({
      min_qty: Number(t?.min_qty) || 0,
      type: t?.type === 'dirham' || t?.type === 'percent' ? t.type : 'centime',
      value: Number(t?.value) || 0,
      basis: t?.basis === 'boite' ? 'boite' : 'kilo',
    }))
    .filter((t: DiscountTier) => t.min_qty > 0 && t.value > 0)
    .sort((a: DiscountTier, b: DiscountTier) => a.min_qty - b.min_qty)
  return {
    transport_rate: Number(raw.transport_rate) || 0,
    discount_tiers,
  }
}

// Palier applicable = celui de plus grand min_qty <= cumulQty (null si aucun atteint).
export function getApplicableTier(cumulQty: number, tiers: DiscountTier[] = []): DiscountTier | null {
  let best: DiscountTier | null = null
  for (const t of tiers) {
    if (cumulQty >= t.min_qty && (!best || t.min_qty > best.min_qty)) best = t
  }
  return best
}

// Réduction (dh) appliquée à une ligne pour un palier donné.
export function tierLineReduction(tier: DiscountTier | null, line: DiscountableLine): number {
  if (!tier) return 0
  if (tier.type === 'percent') {
    return Math.max(0, (Number(line.line_total) || 0) * (tier.value / 100))
  }
  const valueDh = tier.type === 'centime' ? tier.value / 100 : tier.value
  if (tier.basis === 'boite') {
    const count = BOITE_UNITS.has(String(line.unit_type)) ? Number(line.quantity) || 0 : 0
    return Math.max(0, valueDh * count)
  }
  // basis kilo
  return Math.max(0, valueDh * (Number(line.base_quantity) || 0))
}

// Réduction totale sur un ensemble de lignes pour un palier donné.
export function tierTotalReduction(tier: DiscountTier | null, lines: DiscountableLine[]): number {
  if (!tier) return 0
  return lines.reduce((sum, l) => sum + tierLineReduction(tier, l), 0)
}

// Quantité de base (kg) d'une ligne, avec repli sur la quantité brute.
export function lineBaseQty(line: { base_quantity?: number; quantity?: number }): number {
  const base = Number(line?.base_quantity)
  if (Number.isFinite(base) && base > 0) return base
  return Number(line?.quantity) || 0
}

// Libellé court d'un palier, ex: "-0,20 dh/kg" ou "-3% ".
export function tierLabel(tier: DiscountTier | null): string {
  if (!tier) return ''
  const unit = tier.basis === 'boite' ? 'صندوق' : 'كغ'
  if (tier.type === 'percent') return `-${tier.value}%`
  const valueDh = tier.type === 'centime' ? tier.value / 100 : tier.value
  return `-${valueDh.toFixed(2)} د.م/${unit}`
}

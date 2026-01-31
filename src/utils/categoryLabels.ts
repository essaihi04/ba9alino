export const CATEGORY_LABELS_AR: Record<string, string> = {
  A: 'زبون خاص / Spécial (A)',
  B: 'الجملة / Grossiste (B)',
  C: 'نصف الجملة / Semi-grossiste (C)',
  D: 'مول الحانوت / Détaillant (D)',
  E: 'التقسيط / Détail (E)'
}

export function getCategoryLabelArabic(tier?: string): string {
  if (!tier) return ''
  return CATEGORY_LABELS_AR[tier] || tier
}

// Normalisation de texte pour la recherche.
// - Met en minuscules (ASCII)
// - Supprime les diacritiques (tashkeel arabe + accents latins)
// - Unifie les variantes arabes:
//   ا/أ/إ/آ -> ا
//   ي/ى/ئ -> ي
//   ة -> ه
//   ؤ -> و
// - Supprime les caractères non alphanumériques (espaces multiples, tirets, tatweel ـ)
export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return ''
  let s = String(input)

  // Supprimer les diacritiques (combining marks: U+064B–U+065F, U+0670, etc.) et autres
  s = s.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0300-\u036F]/g, '')

  // Supprimer le tatweel (ـ)
  s = s.replace(/\u0640/g, '')

  // Unifier les alefs
  s = s.replace(/[\u0622\u0623\u0625]/g, '\u0627') // آأإ -> ا

  // Unifier yaa et alef maksura
  s = s.replace(/[\u0649\u064A\u0626]/g, '\u064A') // ى ي ئ -> ي

  // taa marbuta -> haa
  s = s.replace(/\u0629/g, '\u0647')

  // hamza on waw -> waw
  s = s.replace(/\u0624/g, '\u0648')

  // hamza isolée
  s = s.replace(/\u0621/g, '')

  // Lowercase pour le latin
  s = s.toLowerCase()

  // Compresser les espaces et trim
  s = s.replace(/\s+/g, ' ').trim()

  return s
}

// Vérifie si haystack contient needle après normalisation des deux.
export function matchesSearch(haystack: string | null | undefined, needle: string | null | undefined): boolean {
  const n = normalizeSearch(needle)
  if (!n) return true
  return normalizeSearch(haystack).includes(n)
}

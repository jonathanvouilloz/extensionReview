// Configuration pour la génération de codes
const CODE_CONFIG = {
  CHARS: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  SECTIONS: 3,
  SECTION_LENGTH: 3,
  SEPARATOR: '-',
  TOTAL_LENGTH: 11 // 3 + 1 + 3 + 1 + 3 = 11
} as const

// Regex pour valider le format des codes
export const PROJECT_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/

/**
 * Génère un code projet unique au format ABC-123-XYZ
 * @returns {string} Code projet formaté
 */
export function generateProjectCode(): string {
  const sections: string[] = []
  
  for (let i = 0; i < CODE_CONFIG.SECTIONS; i++) {
    let section = ''
    for (let j = 0; j < CODE_CONFIG.SECTION_LENGTH; j++) {
      const randomIndex = Math.floor(Math.random() * CODE_CONFIG.CHARS.length)
      section += CODE_CONFIG.CHARS.charAt(randomIndex)
    }
    sections.push(section)
  }
  
  return sections.join(CODE_CONFIG.SEPARATOR)
}

/**
 * Génère un UUID v4 standard
 * @returns {string} UUID
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Valide le format d'un code projet
 * @param {string} code - Code à valider
 * @returns {boolean} True si le format est valide
 */
export function isValidProjectCodeFormat(code: string): boolean {
  return PROJECT_CODE_REGEX.test(code)
}

/**
 * Génère un hash sécurisé d'un code projet
 * @param {string} code - Code à hasher
 * @returns {Promise<string>} Hash SHA-256 en hexadécimal
 */
export async function hashProjectCode(code: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(code)
  const hash = await crypto.subtle.digest('SHA-256', data)
  
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Génère plusieurs codes projet uniques
 * @param {number} count - Nombre de codes à générer
 * @returns {string[]} Array de codes uniques
 */
export function generateMultipleProjectCodes(count: number): string[] {
  // Limite raisonnable pour éviter les problèmes de performance
  if (count > 100000) {
    throw new Error(`Nombre de codes demandé trop élevé: ${count}. Maximum: 100000`)
  }
  
  const codes = new Set<string>()
  let attempts = 0
  const maxAttempts = Math.min(count * 10, 1000000) // Limite de sécurité
  
  while (codes.size < count && attempts < maxAttempts) {
    codes.add(generateProjectCode())
    attempts++
  }
  
  if (codes.size < count) {
    throw new Error(`Impossible de générer ${count} codes uniques après ${maxAttempts} tentatives`)
  }
  
  return Array.from(codes)
}

/**
 * Calcule la probabilité de collision pour un nombre donné de codes
 * @param {number} codeCount - Nombre de codes générés
 * @returns {number} Probabilité de collision (0-1)
 */
export function calculateCollisionProbability(codeCount: number): number {
  // Espace total des codes possibles: 36^9 = 101,559,956,668,416
  const totalSpace = Math.pow(36, 9)
  
  // Approximation de la probabilité de collision (problème des anniversaires)
  const probability = 1 - Math.exp(-((codeCount * (codeCount - 1)) / (2 * totalSpace)))
  
  return Math.max(0, Math.min(1, probability))
}

/**
 * Normalise un code projet (supprime espaces, convertit en majuscules)
 * @param {string} code - Code à normaliser
 * @returns {string} Code normalisé
 */
export function normalizeProjectCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

/**
 * Extrait les parties d'un code projet
 * @param {string} code - Code projet
 * @returns {string[] | null} Array des 3 parties ou null si format invalide
 */
export function parseProjectCode(code: string): string[] | null {
  if (!isValidProjectCodeFormat(code)) {
    return null
  }
  
  return code.split(CODE_CONFIG.SEPARATOR)
}

/**
 * Génère un code projet avec vérification d'unicité contre une liste
 * @param {string[]} existingCodes - Codes existants à éviter
 * @param {number} maxAttempts - Nombre maximum de tentatives
 * @returns {string} Code unique
 */
export function generateUniqueProjectCode(
  existingCodes: string[] = [], 
  maxAttempts: number = 100
): string {
  const existingSet = new Set(existingCodes)
  
  // Si le ratio existingCodes/maxAttempts est très défavorable, échouer rapidement
  if (existingCodes.length > 1000 && maxAttempts < 100) {
    throw new Error(`Trop de codes existants (${existingCodes.length}) pour si peu de tentatives (${maxAttempts})`)
  }
  
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateProjectCode()
    if (!existingSet.has(code)) {
      return code
    }
  }
  
  throw new Error(`Impossible de générer un code unique après ${maxAttempts} tentatives`)
} 
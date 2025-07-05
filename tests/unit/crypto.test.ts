import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateProjectCode,
  generateId,
  isValidProjectCodeFormat,
  hashProjectCode,
  generateMultipleProjectCodes,
  calculateCollisionProbability,
  normalizeProjectCode,
  parseProjectCode,
  generateUniqueProjectCode,
  PROJECT_CODE_REGEX
} from '../../src/utils/crypto'

describe('Crypto Utils', () => {
  describe('generateProjectCode', () => {
    it('should generate a project code with correct format', () => {
      const code = generateProjectCode()
      
      expect(code).toMatch(PROJECT_CODE_REGEX)
      expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/)
      expect(code).toHaveLength(11)
    })

    it('should generate different codes on multiple calls', () => {
      const codes = Array.from({ length: 10 }, () => generateProjectCode())
      const uniqueCodes = new Set(codes)
      
      // Avec l'espace de codes disponible, il devrait y avoir 10 codes uniques
      expect(uniqueCodes.size).toBe(10)
    })

    it('should only contain valid characters', () => {
      const code = generateProjectCode()
      const parts = code.split('-')
      
      parts.forEach(part => {
        expect(part).toMatch(/^[A-Z0-9]{3}$/)
      })
    })

    it('should have exactly 3 sections separated by hyphens', () => {
      const code = generateProjectCode()
      const parts = code.split('-')
      
      expect(parts).toHaveLength(3)
      parts.forEach(part => {
        expect(part).toHaveLength(3)
      })
    })
  })

  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId()
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate unique IDs', () => {
      const ids = Array.from({ length: 100 }, () => generateId())
      const uniqueIds = new Set(ids)
      
      expect(uniqueIds.size).toBe(100)
    })
  })

  describe('isValidProjectCodeFormat', () => {
    it('should validate correct format codes', () => {
      const validCodes = [
        'ABC-123-XYZ',
        'A1B-2C3-D4E',
        'ZZZ-999-AAA',
        '000-111-222'
      ]

      validCodes.forEach(code => {
        expect(isValidProjectCodeFormat(code)).toBe(true)
      })
    })

    it('should reject invalid format codes', () => {
      const invalidCodes = [
        'ABC-123-XY',    // Section trop courte
        'ABC-123-XYZA',  // Section trop longue
        'ABC-123',       // Pas assez de sections
        'ABC-123-XYZ-456', // Trop de sections
        'abc-123-xyz',   // Minuscules
        'ABC 123 XYZ',   // Espaces au lieu de tirets
        'ABC_123_XYZ',   // Underscores
        'ABC-12@-XYZ',   // Caractères spéciaux
        '',              // Vide
        'ABC-123-XYZ-',  // Tiret final
        '-ABC-123-XYZ'   // Tiret initial
      ]

      invalidCodes.forEach(code => {
        expect(isValidProjectCodeFormat(code)).toBe(false)
      })
    })
  })

  describe('hashProjectCode', () => {
    it('should generate a consistent hash for the same code', async () => {
      const code = 'ABC-123-XYZ'
      const hash1 = await hashProjectCode(code)
      const hash2 = await hashProjectCode(code)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 en hex = 64 caractères
    })

    it('should generate different hashes for different codes', async () => {
      const hash1 = await hashProjectCode('ABC-123-XYZ')
      const hash2 = await hashProjectCode('XYZ-321-ABC')
      
      expect(hash1).not.toBe(hash2)
    })

    it('should generate valid hexadecimal hash', async () => {
      const hash = await hashProjectCode('ABC-123-XYZ')
      
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('generateMultipleProjectCodes', () => {
    it('should generate the requested number of unique codes', () => {
      const codes = generateMultipleProjectCodes(50)
      
      expect(codes).toHaveLength(50)
      
      // Vérifier que tous les codes sont uniques
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(50)
    })

    it('should generate codes with valid format', () => {
      const codes = generateMultipleProjectCodes(10)
      
      codes.forEach(code => {
        expect(isValidProjectCodeFormat(code)).toBe(true)
      })
    })

    it('should throw error if unable to generate enough unique codes', () => {
      // Test avec un nombre très élevé qui devrait échouer
      expect(() => generateMultipleProjectCodes(1000000)).toThrow()
    })
  })

  describe('calculateCollisionProbability', () => {
    it('should return 0 for 0 codes', () => {
      expect(calculateCollisionProbability(0)).toBe(0)
    })

    it('should return very low probability for small numbers', () => {
      const probability = calculateCollisionProbability(100)
      expect(probability).toBeLessThan(0.00001) // Très faible probabilité
    })

    it('should return higher probability for larger numbers', () => {
      const prob1 = calculateCollisionProbability(100)
      const prob2 = calculateCollisionProbability(1000)
      
      expect(prob2).toBeGreaterThan(prob1)
    })

    it('should return value between 0 and 1', () => {
      const probability = calculateCollisionProbability(1000)
      expect(probability).toBeGreaterThanOrEqual(0)
      expect(probability).toBeLessThanOrEqual(1)
    })
  })

  describe('normalizeProjectCode', () => {
    it('should remove spaces and convert to uppercase', () => {
      expect(normalizeProjectCode('  abc-123-xyz  ')).toBe('ABC-123-XYZ')
      expect(normalizeProjectCode('abc 123 xyz')).toBe('ABC123XYZ')
      expect(normalizeProjectCode('  A B C - 1 2 3 - X Y Z  ')).toBe('ABC-123-XYZ')
    })

    it('should handle empty strings', () => {
      expect(normalizeProjectCode('')).toBe('')
      expect(normalizeProjectCode('   ')).toBe('')
    })
  })

  describe('parseProjectCode', () => {
    it('should parse valid project codes', () => {
      const result = parseProjectCode('ABC-123-XYZ')
      expect(result).toEqual(['ABC', '123', 'XYZ'])
    })

    it('should return null for invalid codes', () => {
      const invalidCodes = ['ABC-123', 'ABC-123-XY', 'invalid']
      
      invalidCodes.forEach(code => {
        expect(parseProjectCode(code)).toBeNull()
      })
    })
  })

  describe('generateUniqueProjectCode', () => {
    it('should generate a code not in the existing list', () => {
      const existingCodes = ['ABC-123-XYZ', 'DEF-456-UVW']
      const newCode = generateUniqueProjectCode(existingCodes)
      
      expect(isValidProjectCodeFormat(newCode)).toBe(true)
      expect(existingCodes).not.toContain(newCode)
    })

    it('should work with empty existing codes list', () => {
      const newCode = generateUniqueProjectCode([])
      expect(isValidProjectCodeFormat(newCode)).toBe(true)
    })

    it('should throw error if unable to generate unique code', () => {
      // Simuler un cas où tous les codes sont pris (impossible en réalité)
      const mockCodes = Array.from({ length: 10000 }, () => generateProjectCode())
      
      expect(() => generateUniqueProjectCode(mockCodes, 10)).toThrow()
    })
  })

  describe('Collision Test - 1000 generations', () => {
    it('should generate 1000 unique codes without collisions', () => {
      const codes = generateMultipleProjectCodes(1000)
      
      // Vérifier unicité
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(1000)
      
      // Vérifier format
      codes.forEach(code => {
        expect(isValidProjectCodeFormat(code)).toBe(true)
      })
      
      // Vérifier probabilité théorique
      const probability = calculateCollisionProbability(1000)
      expect(probability).toBeLessThan(0.001) // Moins de 0.1% de chance de collision
    })
  })

  describe('Format Validation Tests', () => {
    it('should validate XXX-XXX-XXX format strictly', () => {
      // Test avec tous les caractères valides
      const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      
      for (let i = 0; i < 10; i++) {
        const code = generateProjectCode()
        expect(code).toMatch(PROJECT_CODE_REGEX)
        
        // Vérifier que chaque caractère est valide
        const cleanCode = code.replace(/-/g, '')
        for (const char of cleanCode) {
          expect(validChars.includes(char)).toBe(true)
        }
      }
    })

    it('should maintain consistent format across all generated codes', () => {
      const codes = Array.from({ length: 100 }, () => generateProjectCode())
      
      codes.forEach(code => {
        expect(code).toHaveLength(11)
        expect(code.charAt(3)).toBe('-')
        expect(code.charAt(7)).toBe('-')
        expect(code.split('-')).toHaveLength(3)
      })
    })
  })

  describe('Performance Tests', () => {
    it('should generate codes quickly', () => {
      const start = Date.now()
      
      for (let i = 0; i < 1000; i++) {
        generateProjectCode()
      }
      
      const duration = Date.now() - start
      expect(duration).toBeLessThan(1000) // Moins de 1 seconde pour 1000 codes
    })

    it('should handle large unique code generation efficiently', () => {
      const start = Date.now()
      const codes = generateMultipleProjectCodes(100)
      const duration = Date.now() - start
      
      expect(codes).toHaveLength(100)
      expect(duration).toBeLessThan(100) // Moins de 100ms pour 100 codes
    })
  })
}) 
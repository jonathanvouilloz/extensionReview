import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validateProjectCode,
  validateUrl,
  sanitizeInput,
  validateCommentData,
  validateProjectData,
  validatePaginationParams,
  validateStatus,
  sanitizeHtml,
  validateCoordinates,
  validateMetadata,
  validateBase64Image
} from '../../src/utils/validation'

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com'
      ]

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true)
      })
    })

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@@example.com',
        'user space@example.com',
        '',
        'user@.com',
        'user@domain.'
      ]

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false)
      })
    })
  })

  describe('validateProjectCode', () => {
    it('should validate correct project code formats', () => {
      const validCodes = [
        'ABC-123-XYZ',
        'A1B-2C3-D4E',
        'ZZZ-999-AAA',
        '000-111-222'
      ]

      validCodes.forEach(code => {
        expect(validateProjectCode(code)).toBe(true)
      })
    })

    it('should reject invalid project code formats', () => {
      const invalidCodes = [
        'ABC-123-XY',    // Section trop courte
        'ABC-123-XYZA',  // Section trop longue
        'ABC-123',       // Pas assez de sections
        'abc-123-xyz',   // Minuscules
        'ABC 123 XYZ',   // Espaces
        'ABC_123_XYZ',   // Underscores
        '',              // Vide
        'ABC-12@-XYZ'    // Caractères spéciaux
      ]

      invalidCodes.forEach(code => {
        expect(validateProjectCode(code)).toBe(false)
      })
    })
  })

  describe('validateUrl', () => {
    it('should validate correct URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://subdomain.example.com/path?query=value',
        'https://example.com:8080/path#hash'
      ]

      validUrls.forEach(url => {
        expect(validateUrl(url)).toBe(true)
      })
    })

    it('should reject invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com',  // Sans protocole
        'ftp://example.com',  // Protocole non HTTP(S)
        '',
        'https://',
        'https://.'
      ]

      invalidUrls.forEach(url => {
        expect(validateUrl(url)).toBe(false)
      })
    })
  })

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalert("xss")/script')
      expect(sanitizeInput('Normal text')).toBe('Normal text')
      expect(sanitizeInput('  text with spaces  ')).toBe('text with spaces')
    })

    it('should limit length', () => {
      const longText = 'a'.repeat(2000)
      const result = sanitizeInput(longText)
      expect(result.length).toBe(1000)
    })

    it('should handle empty strings', () => {
      expect(sanitizeInput('')).toBe('')
      expect(sanitizeInput('   ')).toBe('')
    })
  })

  describe('validateCommentData', () => {
    it('should validate correct comment data', () => {
      const validComment = {
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com',
        text: 'This is a valid comment',
        priority: 'normal'
      }

      const errors = validateCommentData(validComment)
      expect(errors).toHaveLength(0)
    })

    it('should catch missing required fields', () => {
      const invalidComment = {
        url: 'https://example.com'
        // Missing project_code and text
      }

      const errors = validateCommentData(invalidComment)
      expect(errors.length).toBeGreaterThan(0)
      expect(errors).toContain('Invalid project code')
      expect(errors).toContain('Comment text is required')
    })

    it('should validate text length', () => {
      const commentWithLongText = {
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com',
        text: 'a'.repeat(1500), // Trop long
        priority: 'normal'
      }

      const errors = validateCommentData(commentWithLongText)
      expect(errors).toContain('Comment text too long (max 1000 characters)')
    })

    it('should validate priority values', () => {
      const commentWithInvalidPriority = {
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com',
        text: 'Valid comment',
        priority: 'urgent' // Invalid priority
      }

      const errors = validateCommentData(commentWithInvalidPriority)
      expect(errors).toContain('Invalid priority')
    })
  })

  describe('validateProjectData', () => {
    it('should validate correct project data', () => {
      const validProject = {
        name: 'Test Project',
        owner_email: 'owner@example.com',
        max_comments: 50,
        notify_email: true
      }

      const errors = validateProjectData(validProject)
      expect(errors).toHaveLength(0)
    })

    it('should catch invalid project name', () => {
      const invalidProject = {
        name: 'A', // Trop court
        owner_email: 'owner@example.com'
      }

      const errors = validateProjectData(invalidProject)
      expect(errors).toContain('Project name must be between 2 and 100 characters')
    })

    it('should validate webhook URL must be HTTPS', () => {
      const projectWithHttpWebhook = {
        name: 'Test Project',
        owner_email: 'owner@example.com',
        webhook_url: 'http://example.com/webhook' // HTTP au lieu de HTTPS
      }

      const errors = validateProjectData(projectWithHttpWebhook)
      expect(errors).toContain('Webhook URL must be a valid HTTPS URL')
    })
  })

  describe('validatePaginationParams', () => {
    it('should validate correct pagination params', () => {
      const errors = validatePaginationParams('1', '10')
      expect(errors).toHaveLength(0)
    })

    it('should catch invalid page numbers', () => {
      const errors = validatePaginationParams('-1', '10')
      expect(errors).toContain('Page must be a positive integer')
    })

    it('should catch invalid per_page values', () => {
      const errors = validatePaginationParams('1', '200')
      expect(errors).toContain('Per page must be between 1 and 100')
    })
  })

  describe('validateStatus', () => {
    it('should validate allowed statuses', () => {
      const allowedStatuses = ['new', 'in_progress', 'resolved']
      
      expect(validateStatus('new', allowedStatuses)).toBe(true)
      expect(validateStatus('resolved', allowedStatuses)).toBe(true)
      expect(validateStatus('invalid', allowedStatuses)).toBe(false)
    })
  })

  describe('sanitizeHtml', () => {
    it('should escape HTML characters', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;')
      expect(sanitizeHtml('Normal text')).toBe('Normal text')
      expect(sanitizeHtml('Text with "quotes" and \'apostrophes\'')).toBe('Text with &quot;quotes&quot; and &#x27;apostrophes&#x27;')
    })
  })

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      const validCoordinates = {
        x: 100,
        y: 200,
        width: 300,
        height: 400
      }

      expect(validateCoordinates(validCoordinates)).toBe(true)
    })

    it('should reject invalid coordinates', () => {
      const invalidCoordinates = [
        null,
        undefined,
        {},
        { x: 100 }, // Missing other properties
        { x: -1, y: 200, width: 300, height: 400 }, // Negative x
        { x: 100, y: 200, width: 0, height: 400 }, // Zero width
        { x: 100, y: 200, width: 300, height: -1 } // Negative height
      ]

      invalidCoordinates.forEach(coords => {
        expect(validateCoordinates(coords)).toBe(false)
      })
    })
  })

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const validMetadata = {
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        screen_resolution: '1920x1080'
      }

      const errors = validateMetadata(validMetadata)
      expect(errors).toHaveLength(0)
    })

    it('should catch invalid screen resolution format', () => {
      const invalidMetadata = {
        screen_resolution: 'invalid-format'
      }

      const errors = validateMetadata(invalidMetadata)
      expect(errors).toContain('Screen resolution must be in format WIDTHxHEIGHT')
    })

    it('should catch too long user agent', () => {
      const invalidMetadata = {
        user_agent: 'a'.repeat(600) // Trop long
      }

      const errors = validateMetadata(invalidMetadata)
      expect(errors).toContain('User agent too long (max 500 characters)')
    })
  })

  describe('validateBase64Image', () => {
    it('should validate correct base64 images', () => {
      const validBase64Images = [
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCs/9k=',
        'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA'
      ]

      validBase64Images.forEach(image => {
        expect(validateBase64Image(image)).toBe(true)
      })
    })

    it('should reject invalid base64 images', () => {
      const invalidBase64Images = [
        '',
        'not-base64',
        'data:text/plain;base64,SGVsbG8gV29ybGQ=', // Not an image
        'data:image/png;base64,invalid-base64-data'
      ]

      invalidBase64Images.forEach(image => {
        expect(validateBase64Image(image)).toBe(false)
      })

      // Test null et undefined séparément
      expect(validateBase64Image(null as any)).toBe(false)
      expect(validateBase64Image(undefined as any)).toBe(false)
    })
  })
}) 
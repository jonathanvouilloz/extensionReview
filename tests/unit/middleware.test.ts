import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Hono } from 'hono'
import {
  corsMiddleware,
  rateLimitMiddleware,
  securityMiddleware,
  headerValidationMiddleware,
  injectionProtectionMiddleware,
  loggingMiddleware,
  errorHandlingMiddleware,
  requestSizeMiddleware
} from '../../src/middleware'

// Mock Context pour les tests
const createMockContext = (overrides: any = {}) => {
  const mockRequest = {
    method: 'GET',
    url: 'http://localhost/test',
    path: '/test',
    header: vi.fn(),
    json: vi.fn(),
    ...(overrides.req || {})
  }

  const mockHeaders = new Map()
  
  return {
    req: mockRequest,
    header: vi.fn((key: string, value: string) => {
      mockHeaders.set(key, value)
    }),
    json: vi.fn(),
    text: vi.fn(),
    env: {
      NODE_ENV: 'test'
    },
    ...overrides
  } as any
}

describe('Middleware Tests', () => {
  describe('corsMiddleware', () => {
    it('should set CORS headers', async () => {
      const mockContext = createMockContext()
      const next = vi.fn()

      await corsMiddleware(mockContext, next)

      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*')
      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      expect(next).toHaveBeenCalled()
    })

    it('should handle OPTIONS requests', async () => {
      const mockContext = createMockContext({
        req: { method: 'OPTIONS' }
      })
      const next = vi.fn()

      const result = await corsMiddleware(mockContext, next) as Response

      expect(result).toBeInstanceOf(Response)
      expect(result.status).toBe(204)
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('rateLimitMiddleware', () => {
    beforeEach(() => {
      // Reset le store pour chaque test
      vi.clearAllMocks()
    })

    it('should allow requests under limit', async () => {
      const middleware = rateLimitMiddleware(10, 60000)
      const mockContext = createMockContext({
        req: {
          header: vi.fn().mockReturnValue('127.0.0.1')
        }
      })
      const next = vi.fn()

      await middleware(mockContext, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })

    it('should block requests over limit', async () => {
      const middleware = rateLimitMiddleware(1, 60000)
      const mockContext = createMockContext({
        req: {
          header: vi.fn().mockReturnValue('127.0.0.1')
        }
      })
      const next = vi.fn()

      // Premier appel - devrait passer
      await middleware(mockContext, next)
      expect(next).toHaveBeenCalledTimes(1)

      // Deuxième appel - devrait être bloqué
      await middleware(mockContext, next)
      expect(mockContext.json).toHaveBeenCalledWith({ error: 'Too many requests' }, 429)
      expect(next).toHaveBeenCalledTimes(1) // Pas appelé une deuxième fois
    })
  })

  describe('securityMiddleware', () => {
    it('should set security headers', async () => {
      const mockContext = createMockContext({
        req: {
          header: vi.fn().mockReturnValue('https')
        }
      })
      const next = vi.fn()

      await securityMiddleware(mockContext, next)

      expect(mockContext.header).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff')
      expect(mockContext.header).toHaveBeenCalledWith('X-Frame-Options', 'DENY')
      expect(mockContext.header).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block')
      expect(next).toHaveBeenCalled()
    })

    it('should set HSTS for HTTPS requests', async () => {
      const mockContext = createMockContext({
        req: {
          header: vi.fn((key: string) => {
            if (key === 'X-Forwarded-Proto') return 'https'
            return null
          })
        }
      })
      const next = vi.fn()

      await securityMiddleware(mockContext, next)

      expect(mockContext.header).toHaveBeenCalledWith(
        'Strict-Transport-Security', 
        'max-age=31536000; includeSubDomains; preload'
      )
      expect(next).toHaveBeenCalled()
    })
  })

  describe('headerValidationMiddleware', () => {
    it('should validate Content-Type for POST requests', async () => {
      const mockContext = createMockContext({
        req: {
          method: 'POST',
          header: vi.fn((key: string) => {
            if (key === 'Content-Type') return 'text/plain'
            return null
          })
        }
      })
      const next = vi.fn()

      await headerValidationMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Invalid Content-Type. Use application/json or multipart/form-data' }, 
        400
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow valid Content-Type', async () => {
      const mockContext = createMockContext({
        req: {
          method: 'POST',
          header: vi.fn((key: string) => {
            if (key === 'Content-Type') return 'application/json'
            return null
          })
        }
      })
      const next = vi.fn()

      await headerValidationMiddleware(mockContext, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })

    it('should block suspicious user agents in production', async () => {
      const mockContext = createMockContext({
        req: {
          header: vi.fn((key: string) => {
            if (key === 'User-Agent') return 'curl/7.68.0'
            return null
          })
        },
        env: {
          NODE_ENV: 'production'
        }
      })
      const next = vi.fn()

      await headerValidationMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Suspicious user agent detected' }, 
        403
      )
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('injectionProtectionMiddleware', () => {
    it('should block SQL injection in query parameters', async () => {
      const mockContext = createMockContext({
        req: {
          url: 'http://localhost/test?search=\'; DROP TABLE users; --'
        }
      })
      const next = vi.fn()

      await injectionProtectionMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Suspicious content detected in query parameters' }, 
        400
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should block XSS in request body', async () => {
      const mockContext = createMockContext({
        req: {
          method: 'POST',
          json: vi.fn().mockResolvedValue({
            text: '<script>alert("XSS")</script>'
          })
        }
      })
      const next = vi.fn()

      await injectionProtectionMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Suspicious content detected in request body' }, 
        400
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow clean content', async () => {
      const mockContext = createMockContext({
        req: {
          url: 'http://localhost/test?search=normal search',
          method: 'POST',
          json: vi.fn().mockResolvedValue({
            text: 'This is a normal comment'
          })
        }
      })
      const next = vi.fn()

      await injectionProtectionMiddleware(mockContext, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })
  })

  describe('loggingMiddleware', () => {
    it('should log request information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      
      const mockContext = createMockContext({
        req: {
          method: 'GET',
          path: '/test',
          header: vi.fn((key: string) => {
            if (key === 'CF-Connecting-IP') return '127.0.0.1'
            if (key === 'User-Agent') return 'Test Agent'
            return null
          })
        }
      })
      const next = vi.fn()

      await loggingMiddleware(mockContext, next)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📥 GET /test - IP: 127.0.0.1')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('📤 GET /test -')
      )
      expect(next).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('errorHandlingMiddleware', () => {
    it('should catch and handle errors in development', async () => {
      const mockContext = createMockContext({
        env: {
          NODE_ENV: 'development'
        }
      })
      const next = vi.fn().mockRejectedValue(new Error('Test error'))

      await errorHandlingMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { 
          error: 'Internal server error',
          details: 'Test error'
        }, 
        500
      )
    })

    it('should hide error details in production', async () => {
      const mockContext = createMockContext({
        env: {
          NODE_ENV: 'production'
        }
      })
      const next = vi.fn().mockRejectedValue(new Error('Test error'))

      await errorHandlingMiddleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Internal server error' }, 
        500
      )
    })
  })

  describe('requestSizeMiddleware', () => {
    it('should block requests over size limit', async () => {
      const middleware = requestSizeMiddleware(1000) // 1KB limit
      const mockContext = createMockContext({
        req: {
          header: vi.fn((key: string) => {
            if (key === 'Content-Length') return '2000' // 2KB
            return null
          })
        }
      })
      const next = vi.fn()

      await middleware(mockContext, next)

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Request too large' }, 
        413
      )
      expect(next).not.toHaveBeenCalled()
    })

    it('should allow requests under size limit', async () => {
      const middleware = requestSizeMiddleware(1000) // 1KB limit
      const mockContext = createMockContext({
        req: {
          header: vi.fn((key: string) => {
            if (key === 'Content-Length') return '500' // 0.5KB
            return null
          })
        }
      })
      const next = vi.fn()

      await middleware(mockContext, next)

      expect(next).toHaveBeenCalled()
      expect(mockContext.json).not.toHaveBeenCalled()
    })
  })
}) 
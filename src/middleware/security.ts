import { createMiddleware } from 'hono/factory'
import { sanitizeHtml } from '../utils/validation'

// Middleware de sécurité général
export const securityMiddleware = createMiddleware(async (c, next) => {
  // Headers de sécurité
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('X-XSS-Protection', '1; mode=block')
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Content Security Policy pour les réponses HTML
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'")
  
  // Strict Transport Security (HTTPS uniquement)
  if (c.req.header('X-Forwarded-Proto') === 'https') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  await next()
})

// Middleware de validation des headers
export const headerValidationMiddleware = createMiddleware(async (c, next) => {
  const contentType = c.req.header('Content-Type')
  const userAgent = c.req.header('User-Agent')
  
  // Validation Content-Type pour les requêtes POST/PUT
  if (['POST', 'PUT'].includes(c.req.method) && contentType) {
    if (!contentType.startsWith('application/json') && !contentType.startsWith('multipart/form-data')) {
      return c.json({ error: 'Invalid Content-Type. Use application/json or multipart/form-data' }, 400)
    }
  }

  // Validation User-Agent
  if (userAgent && userAgent.length > 500) {
    return c.json({ error: 'User-Agent header too long' }, 400)
  }

  // Bloquer les user agents suspicieux
  const suspiciousUserAgents = [
    'curl/7.', 'wget/', 'python-requests/', 'Go-http-client/', 'libwww-perl/'
  ]
  
  if (userAgent && suspiciousUserAgents.some(ua => userAgent.includes(ua))) {
    // En mode développement, on log seulement
    if (c.env?.NODE_ENV === 'development') {
      console.log('⚠️ Suspicious user agent detected:', userAgent)
    } else {
      return c.json({ error: 'Suspicious user agent detected' }, 403)
    }
  }

  await next()
})

// Middleware de protection contre les attaques de timing
export const timingAttackProtectionMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now()
  
  await next()
  
  const processingTime = Date.now() - startTime
  
  // Ajouter un délai minimum pour les requêtes d'authentification
  if (c.req.path.includes('/auth') || c.req.path.includes('/login')) {
    const minDelay = 100 // 100ms minimum
    if (processingTime < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - processingTime))
    }
  }
})

// Middleware de protection contre les injections
export const injectionProtectionMiddleware = createMiddleware(async (c, next) => {
  // Vérifier les paramètres de requête
  const url = new URL(c.req.url)
  const params = url.searchParams
  
  for (const [key, value] of params.entries()) {
    if (containsSqlInjection(value) || containsScriptInjection(value)) {
      return c.json({ error: 'Suspicious content detected in query parameters' }, 400)
    }
  }

  // Vérifier le body pour les requêtes POST/PUT
  if (['POST', 'PUT'].includes(c.req.method)) {
    try {
      const body = await c.req.json()
      if (containsSuspiciousContent(body)) {
        return c.json({ error: 'Suspicious content detected in request body' }, 400)
      }
    } catch {
      // Si le parsing JSON échoue, on laisse passer (sera géré par les autres middlewares)
    }
  }

  await next()
})

// Middleware de logging des requêtes
export const loggingMiddleware = createMiddleware(async (c, next) => {
  const startTime = Date.now()
  const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
  const userAgent = c.req.header('User-Agent') || 'unknown'
  const method = c.req.method
  const path = c.req.path
  
  console.log(`📥 ${method} ${path} - IP: ${clientIP.substring(0, 15)}... - UA: ${userAgent.substring(0, 50)}...`)
  
  await next()
  
  const processingTime = Date.now() - startTime
  console.log(`📤 ${method} ${path} - ${processingTime}ms`)
})

// Middleware de gestion d'erreurs
export const errorHandlingMiddleware = createMiddleware(async (c, next) => {
  try {
    await next()
  } catch (error) {
    console.error('❌ Unhandled error:', error)
    
    // Ne pas exposer les détails de l'erreur en production
    if (c.env?.NODE_ENV === 'production') {
      return c.json({ error: 'Internal server error' }, 500)
    } else {
      return c.json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }, 500)
    }
  }
})

// Utilitaires de détection d'injections
function containsSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
    /(;|\|\||&&)/,
    /(-{2}|\/\*|\*\/)/
  ]
  
  return sqlPatterns.some(pattern => pattern.test(input))
}

function containsScriptInjection(input: string): boolean {
  const scriptPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi
  ]
  
  return scriptPatterns.some(pattern => pattern.test(input))
}

function containsSuspiciousContent(obj: any): boolean {
  if (typeof obj === 'string') {
    return containsSqlInjection(obj) || containsScriptInjection(obj)
  }
  
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if (containsSuspiciousContent(obj[key])) {
        return true
      }
    }
  }
  
  return false
}

// Middleware de validation de la taille des requêtes
export const requestSizeMiddleware = (maxSize: number = 10 * 1024 * 1024) => { // 10MB par défaut
  return createMiddleware(async (c, next) => {
    const contentLength = c.req.header('Content-Length')
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return c.json({ error: 'Request too large' }, 413)
    }
    
    await next()
  })
} 
import { createMiddleware } from 'hono/factory'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const store: RateLimitStore = {}

export const rateLimitMiddleware = (maxRequests: number = 100, windowMs: number = 60000) => {
  return createMiddleware(async (c, next) => {
    const clientIP = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const now = Date.now()
    const windowStart = now - windowMs

    // Nettoyer les entrées expirées
    Object.keys(store).forEach(key => {
      if (store[key].resetTime < windowStart) {
        delete store[key]
      }
    })

    // Vérifier limite pour cette IP
    if (!store[clientIP]) {
      store[clientIP] = { count: 0, resetTime: now + windowMs }
    }

    if (store[clientIP].count >= maxRequests) {
      return c.json({ error: 'Too many requests' }, 429)
    }

    store[clientIP].count++
    await next()
  })
} 
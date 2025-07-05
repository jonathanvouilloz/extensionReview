import { createMiddleware } from 'hono/factory'

export const corsMiddleware = createMiddleware(async (c, next) => {
  // Headers CORS pour extension Chrome
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return new Response('', { status: 204 })
  }

  await next()
}) 
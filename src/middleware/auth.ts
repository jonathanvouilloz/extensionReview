import { createMiddleware } from 'hono/factory'
import { validateEmail } from '../utils/validation'

// Configuration des clés API (à déplacer dans l'environnement en production)
const API_KEYS = new Set([
  'demo-key-12345',
  'test-key-67890',
  // En production, ces clés seraient dans la base de données
])

// Middleware d'authentification avancé
export const authMiddleware = createMiddleware(async (c, next) => {
  // Exemption pour les endpoints publics
  const publicEndpoints = ['/health', '/api']
  const path = c.req.path
  
  if (publicEndpoints.includes(path)) {
    await next()
    return
  }

  const authHeader = c.req.header('Authorization')
  
  // Vérifier présence du header Authorization
  if (!authHeader) {
    return c.json({ error: 'Authorization header required' }, 401)
  }

  // Vérifier format Bearer token
  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Invalid authorization format. Use Bearer token' }, 401)
  }

  const token = authHeader.substring(7)
  
  // Validation basique du token
  if (!token || token.length < 8) {
    return c.json({ error: 'Invalid token format' }, 401)
  }

  // Vérifier si le token est dans la liste des clés API valides
  if (!API_KEYS.has(token)) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // Ajouter les informations d'authentification au contexte
  c.set('authenticated', true)
  c.set('api_key', token)
  
  await next()
})

// Middleware d'authentification optionnel (pour les endpoints publics avec auth optionnelle)
export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    if (token && API_KEYS.has(token)) {
      c.set('authenticated', true)
      c.set('api_key', token)
    }
  }
  
  await next()
})

// Middleware pour valider les permissions de propriétaire de projet
export const projectOwnerAuthMiddleware = createMiddleware(async (c, next) => {
  const ownerEmail = c.req.header('X-Owner-Email')
  
  if (!ownerEmail || !validateEmail(ownerEmail)) {
    return c.json({ error: 'Valid owner email required in X-Owner-Email header' }, 401)
  }

  c.set('owner_email', ownerEmail)
  await next()
})

// Utilitaire pour générer des clés API
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result
}

// Validation des tokens JWT (pour future implémentation)
export function validateJWT(token: string): boolean {
  // TODO: Implémenter validation JWT complète
  try {
    // Validation basique du format JWT
    const parts = token.split('.')
    return parts.length === 3
  } catch {
    return false
  }
} 
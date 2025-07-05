import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { 
	rateLimitMiddleware,
	securityMiddleware,
	headerValidationMiddleware,
	injectionProtectionMiddleware,
	loggingMiddleware,
	errorHandlingMiddleware,
	requestSizeMiddleware
} from './middleware'
import { projectRoutes } from './routes/projects'
import { commentRoutes } from './routes/comments'

import { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// Middleware de gestion d'erreurs global (en premier)
app.use('*', errorHandlingMiddleware)

// Middleware de logging (en second pour capturer toutes les requêtes)
app.use('*', loggingMiddleware)

// Middleware de sécurité général
app.use('*', securityMiddleware)

// Middleware de validation des headers
app.use('*', headerValidationMiddleware)

// Middleware de protection contre les injections
app.use('*', injectionProtectionMiddleware)

// Middleware de validation de la taille des requêtes (5MB max)
app.use('*', requestSizeMiddleware(5 * 1024 * 1024))

// Middleware CORS
app.use('*', cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
	allowHeaders: ['Content-Type', 'Authorization', 'X-Owner-Email'],
	maxAge: 86400,
}))

// Rate limiting global
app.use('*', rateLimitMiddleware(100, 60000)) // 100 req/min

// Health check
app.get('/health', (c) => c.json({ 
	status: 'OK', 
	timestamp: new Date().toISOString(),
	version: '1.0.0',
	  environment: 'development' // TODO: Configure environment detection
}))

// API info endpoint
app.get('/api', (c) => c.json({ 
	name: 'Visual Feedback API',
	version: '1.0.0',
	description: 'API for collecting visual feedback on web projects',
	endpoints: {
		projects: '/api/projects',
		comments: '/api/comments'
	},
	documentation: 'https://docs.visualfeedback.dev'
}))

// Endpoint de génération de clé API (pour les tests)
app.get('/api/generate-key', (c) => {
	const { generateApiKey } = require('./middleware/auth')
	
	  // En production, ceci devrait être protégé par authentification admin
  // TODO: Configure proper environment detection
  const isProduction = false // Change this in production
  if (isProduction) {
    return c.json({ error: 'Not available in production' }, 404)
  }
	
	return c.json({ 
		api_key: generateApiKey(),
		note: 'This is a development endpoint. In production, API keys should be managed through the admin interface.'
	})
})

// Middleware de debug - retiré après tests réussis

// Routes principales
app.route('/api/projects', projectRoutes)
app.route('/api/comments', commentRoutes)

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
	console.error('API Error:', err)
	return c.json({ 
		error: 'Internal server error',
		timestamp: new Date().toISOString()
	}, 500)
})

export default app

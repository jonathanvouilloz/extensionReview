import { createMiddleware } from 'hono/factory'
import { 
  validateProjectData, 
  validateCommentData, 
  validatePaginationParams,
  validateStatus,
  validateCoordinates,
  validateMetadata,
  validateBase64Image,
  sanitizeHtml
} from '../utils/validation'

// Middleware de validation des projets
export const validateProjectMiddleware = createMiddleware(async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT') {
    try {
      const body = await c.req.json()
      const errors = validateProjectData(body)
      
      if (errors.length > 0) {
        return c.json({ error: 'Validation failed', details: errors }, 400)
      }
      
      // Sanitizer les données textuelles
      if (body.name) {
        body.name = sanitizeHtml(body.name)
      }
      
      // Remettre le body sanitisé dans le contexte
      c.set('validatedBody', body)
    } catch (error) {
      return c.json({ error: 'Invalid JSON format' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des commentaires
export const validateCommentMiddleware = createMiddleware(async (c, next) => {
  if (c.req.method === 'POST') {
    try {
      const body = await c.req.json()
      const errors = validateCommentData(body)
      
      if (errors.length > 0) {
        return c.json({ error: 'Validation failed', details: errors }, 400)
      }
      
      // Validation des coordonnées si présentes
      if (body.coordinates && !validateCoordinates(body.coordinates)) {
        return c.json({ error: 'Invalid coordinates format' }, 400)
      }
      
      // Validation des métadonnées si présentes
      if (body.metadata) {
        const metadataErrors = validateMetadata(body.metadata)
        if (metadataErrors.length > 0) {
          return c.json({ error: 'Invalid metadata', details: metadataErrors }, 400)
        }
      }
      
      // Validation screenshot base64 si présent
      if (body.screenshot && !validateBase64Image(body.screenshot)) {
        return c.json({ error: 'Invalid screenshot format or size' }, 400)
      }
      
      // Sanitizer les données textuelles
      if (body.text) {
        body.text = sanitizeHtml(body.text)
      }
      
      // Remettre le body sanitisé dans le contexte
      c.set('validatedBody', body)
    } catch (error) {
      return c.json({ error: 'Invalid JSON format' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des paramètres de pagination
export const validatePaginationMiddleware = createMiddleware(async (c, next) => {
  const page = c.req.query('page')
  const perPage = c.req.query('per_page')
  
  if (page || perPage) {
    const errors = validatePaginationParams(page, perPage)
    if (errors.length > 0) {
      return c.json({ error: 'Invalid pagination parameters', details: errors }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des paramètres de filtrage
export const validateFilterMiddleware = createMiddleware(async (c, next) => {
  const status = c.req.query('status')
  const priority = c.req.query('priority')
  const sort = c.req.query('sort')
  const order = c.req.query('order')
  
  // Validation du statut
  if (status && !validateStatus(status, ['new', 'in_progress', 'resolved'])) {
    return c.json({ error: 'Invalid status. Must be: new, in_progress, or resolved' }, 400)
  }
  
  // Validation de la priorité
  if (priority && !validateStatus(priority, ['low', 'normal', 'high'])) {
    return c.json({ error: 'Invalid priority. Must be: low, normal, or high' }, 400)
  }
  
  // Validation du tri
  if (sort && !validateStatus(sort, ['created_at', 'priority', 'status', 'text'])) {
    return c.json({ error: 'Invalid sort field. Must be: created_at, priority, status, or text' }, 400)
  }
  
  // Validation de l'ordre
  if (order && !validateStatus(order, ['asc', 'desc'])) {
    return c.json({ error: 'Invalid order. Must be: asc or desc' }, 400)
  }
  
  await next()
})

// Middleware de validation des IDs
export const validateIdMiddleware = createMiddleware(async (c, next) => {
  const id = c.req.param('id')
  
  if (id) {
    // Validation format UUID v4
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    
    if (!uuidRegex.test(id)) {
      return c.json({ error: 'Invalid ID format. Must be a valid UUID' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des codes projet
export const validateProjectCodeMiddleware = createMiddleware(async (c, next) => {
  const code = c.req.param('code')
  
  if (code) {
    const codeRegex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
    
    if (!codeRegex.test(code)) {
      return c.json({ error: 'Invalid project code format. Must be XXX-XXX-XXX' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des mises à jour de statut
export const validateStatusUpdateMiddleware = createMiddleware(async (c, next) => {
  if (c.req.method === 'PUT' && c.req.path.includes('/status')) {
    try {
      const body = await c.req.json()
      
      if (!body.status) {
        return c.json({ error: 'Status is required' }, 400)
      }
      
      if (!validateStatus(body.status, ['new', 'in_progress', 'resolved'])) {
        return c.json({ error: 'Invalid status. Must be: new, in_progress, or resolved' }, 400)
      }
      
      c.set('validatedBody', body)
    } catch (error) {
      return c.json({ error: 'Invalid JSON format' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des requêtes multipart (pour les uploads)
export const validateMultipartMiddleware = createMiddleware(async (c, next) => {
  const contentType = c.req.header('Content-Type')
  
  if (contentType && contentType.startsWith('multipart/form-data')) {
    try {
      const formData = await c.req.formData()
      const file = formData.get('file') as File
      
      if (file) {
        // Valider le type de fichier
        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
        if (!allowedTypes.includes(file.type)) {
          return c.json({ error: 'Invalid file type. Must be PNG, JPEG, or WebP' }, 400)
        }
        
        // Valider la taille
        if (file.size > 5 * 1024 * 1024) { // 5MB
          return c.json({ error: 'File too large. Maximum size is 5MB' }, 400)
        }
        
        c.set('validatedFile', file)
      }
    } catch (error) {
      return c.json({ error: 'Invalid multipart data' }, 400)
    }
  }
  
  await next()
})

// Middleware de validation des requêtes de recherche
export const validateSearchMiddleware = createMiddleware(async (c, next) => {
  const search = c.req.query('search')
  
  if (search) {
    // Validation longueur
    if (search.length < 2 || search.length > 100) {
      return c.json({ error: 'Search term must be between 2 and 100 characters' }, 400)
    }
    
    // Validation caractères dangereux
    const dangerousChars = ['<', '>', '"', "'", '&', ';', '(', ')', '{', '}']
    if (dangerousChars.some(char => search.includes(char))) {
      return c.json({ error: 'Search term contains invalid characters' }, 400)
    }
    
    // Sanitizer le terme de recherche
    const sanitizedSearch = search.trim().replace(/[^\w\s-]/g, '')
    c.set('sanitizedSearch', sanitizedSearch)
  }
  
  await next()
}) 
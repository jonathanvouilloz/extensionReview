# Plan de Développement Détaillé - Sprint 2

## = SPRINT 2 - API Backend Complète (2 semaines)

### Objectifs
- Compléter l'API avec tous les endpoints nécessaires et validation robuste
- Implémenter le système d'upload et de traitement d'images optimisé
- Ajouter la sécurité avancée avec JWT et rate limiting
- Optimiser les performances avec cache multi-niveaux
- Mettre en place le monitoring et les logs structurés

### Critères d'acceptation
- [ ] Tous les endpoints API documentés et testés
- [ ] Upload d'images fonctionnel avec compression automatique
- [ ] Système d'authentification JWT opérationnel
- [ ] Rate limiting configuré et testé
- [ ] Cache Redis/KV implémenté
- [ ] Logs structurés avec niveaux appropriés
- [ ] Tests d'intégration couvrant tous les endpoints
- [ ] Documentation API complète (OpenAPI/Swagger)

---

### Semaine 1: API Endpoints et Validation

#### T4.1 - Validation avancée des données (Zod)
**Durée**: 4h | **Priorité**: Critique | **Dépendances**: Sprint 1 complété

**Installation et configuration**:
```bash
npm install zod @hono/zod-validator
npm install -D @types/node
```

**Schémas de validation** (`src/validation/schemas.ts`):
```typescript
import { z } from 'zod'

// Validation des emails
const emailSchema = z.string().email('Email invalide')

// Validation du code projet (format: ABC-123-XYZ)
const projectCodeSchema = z.string().regex(
  /^[A-Z]{3}-[0-9]{3}-[A-Z]{3}$/,
  'Code projet invalide. Format attendu: ABC-123-XYZ'
)

// Schéma de création de projet
export const createProjectSchema = z.object({
  name: z.string()
    .min(3, 'Le nom doit contenir au moins 3 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .trim(),
  owner_email: emailSchema,
  max_comments: z.number()
    .int()
    .min(10, 'Minimum 10 commentaires')
    .max(1000, 'Maximum 1000 commentaires')
    .optional()
    .default(100),
  notify_email: z.boolean().optional().default(false),
  webhook_url: z.string().url('URL invalide').optional(),
  expires_in_days: z.number()
    .int()
    .min(7, 'Minimum 7 jours')
    .max(365, 'Maximum 365 jours')
    .optional()
    .default(30)
})

// Schéma de création de commentaire
export const createCommentSchema = z.object({
  project_code: projectCodeSchema,
  url: z.string().url('URL invalide'),
  text: z.string()
    .min(1, 'Le commentaire ne peut pas être vide')
    .max(1000, 'Le commentaire ne peut pas dépasser 1000 caractères')
    .trim(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  screenshot: z.string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, 'Format d\'image invalide')
    .optional(),
  coordinates: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().min(1),
    height: z.number().int().min(1)
  }).optional(),
  metadata: z.object({
    user_agent: z.string().optional(),
    screen_resolution: z.string().optional(),
    viewport_size: z.string().optional(),
    device_type: z.string().optional()
  }).optional()
})

// Schéma de mise à jour de commentaire
export const updateCommentSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  internal_notes: z.string().max(500).optional()
})

// Schéma de filtres pour listing
export const listCommentsSchema = z.object({
  status: z.enum(['new', 'in_progress', 'resolved', 'all']).optional().default('all'),
  priority: z.enum(['low', 'normal', 'high', 'all']).optional().default('all'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
  sort_by: z.enum(['created_at', 'priority', 'status']).optional().default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc')
})

// Types exportés depuis les schémas
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type ListCommentsInput = z.infer<typeof listCommentsSchema>
```

**Middleware de validation** (`src/middleware/validation.ts`):
```typescript
import { Context, Next } from 'hono'
import { ZodError, ZodSchema } from 'zod'

export const validate = (schema: ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json()
      const validated = schema.parse(body)
      c.set('validatedData', validated)
      await next()
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }, 400)
      }
      throw error
    }
  }
}

export const validateQuery = (schema: ZodSchema) => {
  return async (c: Context, next: Next) => {
    try {
      const query = c.req.query()
      const validated = schema.parse(query)
      c.set('validatedQuery', validated)
      await next()
    } catch (error) {
      if (error instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Query validation failed',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }, 400)
      }
      throw error
    }
  }
}
```

**Tests requis**:
- Validation des schémas avec données valides
- Gestion des erreurs de validation
- Messages d'erreur en français
- Types TypeScript corrects

---

#### T4.2 - Endpoints projets complets (CRUD)
**Durée**: 5h | **Priorité**: Critique | **Dépendances**: T4.1

**Routes projets** (`src/routes/projects.ts`):
```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { ProjectService } from '../services/projectService'
import { validate, validateQuery } from '../middleware/validation'
import { createProjectSchema, listProjectsSchema, updateProjectSchema } from '../validation/schemas'
import { auth } from '../middleware/auth'
import { generateProjectCode } from '../utils/crypto'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
}

export const projectRoutes = new Hono<{ Bindings: Bindings }>()

const projectService = new ProjectService()

// Créer un nouveau projet
projectRoutes.post('/', validate(createProjectSchema), async (c) => {
  const data = c.get('validatedData')
  const db = c.env.DB
  
  try {
    // Générer un ID unique et un code projet
    const id = nanoid()
    const code = await generateProjectCode()
    
    // Calculer la date d'expiration
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + (data.expires_in_days || 30))
    
    // Créer le projet
    const project = await projectService.create(db, {
      id,
      code,
      name: data.name,
      owner_email: data.owner_email,
      max_comments: data.max_comments || 100,
      notify_email: data.notify_email || false,
      webhook_url: data.webhook_url,
      expires_at: expiresAt.toISOString()
    })
    
    // Mettre en cache
    await c.env.KV.put(`project:${code}`, JSON.stringify(project), {
      expirationTtl: 3600 // 1 heure
    })
    
    return c.json({
      success: true,
      data: {
        id: project.id,
        code: project.code,
        name: project.name,
        expires_at: project.expires_at,
        share_url: `${c.req.url.origin}/share/${project.code}`
      }
    }, 201)
  } catch (error) {
    console.error('Error creating project:', error)
    return c.json({
      success: false,
      error: 'Failed to create project'
    }, 500)
  }
})

// Obtenir un projet par code
projectRoutes.get('/:code', async (c) => {
  const code = c.req.param('code')
  const db = c.env.DB
  const kv = c.env.KV
  
  try {
    // Vérifier le cache d'abord
    const cached = await kv.get(`project:${code}`)
    if (cached) {
      return c.json({
        success: true,
        data: JSON.parse(cached)
      })
    }
    
    // Sinon, chercher dans la DB
    const project = await projectService.findByCode(db, code)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    // Vérifier si le projet est expiré
    if (new Date(project.expires_at) < new Date()) {
      return c.json({
        success: false,
        error: 'Project has expired'
      }, 410)
    }
    
    // Mettre en cache pour les prochaines requêtes
    await kv.put(`project:${code}`, JSON.stringify(project), {
      expirationTtl: 3600
    })
    
    return c.json({
      success: true,
      data: project
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch project'
    }, 500)
  }
})

// Lister les projets d'un propriétaire (avec auth)
projectRoutes.get('/', auth(), validateQuery(listProjectsSchema), async (c) => {
  const query = c.get('validatedQuery')
  const email = c.get('userEmail')
  const db = c.env.DB
  
  try {
    const projects = await projectService.listByOwner(db, email, {
      limit: query.limit,
      offset: query.offset,
      includeExpired: query.include_expired
    })
    
    return c.json({
      success: true,
      data: projects.data,
      pagination: {
        total: projects.total,
        limit: query.limit,
        offset: query.offset,
        has_more: projects.total > query.offset + query.limit
      }
    })
  } catch (error) {
    console.error('Error listing projects:', error)
    return c.json({
      success: false,
      error: 'Failed to list projects'
    }, 500)
  }
})

// Mettre à jour un projet
projectRoutes.put('/:code', auth(), validate(updateProjectSchema), async (c) => {
  const code = c.req.param('code')
  const data = c.get('validatedData')
  const email = c.get('userEmail')
  const db = c.env.DB
  const kv = c.env.KV
  
  try {
    // Vérifier que l'utilisateur est propriétaire
    const project = await projectService.findByCode(db, code)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    if (project.owner_email !== email) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403)
    }
    
    // Mettre à jour
    const updated = await projectService.update(db, code, data)
    
    // Invalider le cache
    await kv.delete(`project:${code}`)
    
    return c.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating project:', error)
    return c.json({
      success: false,
      error: 'Failed to update project'
    }, 500)
  }
})

// Supprimer un projet
projectRoutes.delete('/:code', auth(), async (c) => {
  const code = c.req.param('code')
  const email = c.get('userEmail')
  const db = c.env.DB
  const kv = c.env.KV
  
  try {
    // Vérifier propriété
    const project = await projectService.findByCode(db, code)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    if (project.owner_email !== email) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403)
    }
    
    // Supprimer projet et commentaires associés
    await projectService.delete(db, code)
    
    // Invalider le cache
    await kv.delete(`project:${code}`)
    
    return c.json({
      success: true,
      message: 'Project deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting project:', error)
    return c.json({
      success: false,
      error: 'Failed to delete project'
    }, 500)
  }
})

// Régénérer le code d'un projet
projectRoutes.post('/:code/regenerate', auth(), async (c) => {
  const oldCode = c.req.param('code')
  const email = c.get('userEmail')
  const db = c.env.DB
  const kv = c.env.KV
  
  try {
    // Vérifier propriété
    const project = await projectService.findByCode(db, oldCode)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    if (project.owner_email !== email) {
      return c.json({
        success: false,
        error: 'Unauthorized'
      }, 403)
    }
    
    // Générer nouveau code
    const newCode = await generateProjectCode()
    
    // Mettre à jour le projet et tous les commentaires
    await projectService.regenerateCode(db, oldCode, newCode)
    
    // Invalider l'ancien cache
    await kv.delete(`project:${oldCode}`)
    
    return c.json({
      success: true,
      data: {
        old_code: oldCode,
        new_code: newCode,
        share_url: `${c.req.url.origin}/share/${newCode}`
      }
    })
  } catch (error) {
    console.error('Error regenerating code:', error)
    return c.json({
      success: false,
      error: 'Failed to regenerate code'
    }, 500)
  }
})
```

**Tests requis**:
- CRUD complet fonctionnel
- Validation des permissions
- Gestion du cache KV
- Régénération de code
- Pagination correcte

---

#### T4.3 - Endpoints commentaires avec filtres
**Durée**: 5h | **Priorité**: Critique | **Dépendances**: T4.1, T4.2

**Routes commentaires** (`src/routes/comments.ts`):
```typescript
import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { CommentService } from '../services/commentService'
import { ProjectService } from '../services/projectService'
import { validate, validateQuery } from '../middleware/validation'
import { createCommentSchema, updateCommentSchema, listCommentsSchema } from '../validation/schemas'
import { uploadImage } from '../utils/imageUpload'
import { sendNotification } from '../utils/notifications'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  KV: KVNamespace
}

export const commentRoutes = new Hono<{ Bindings: Bindings }>()

const commentService = new CommentService()
const projectService = new ProjectService()

// Créer un nouveau commentaire
commentRoutes.post('/', validate(createCommentSchema), async (c) => {
  const data = c.get('validatedData')
  const db = c.env.DB
  const bucket = c.env.BUCKET
  
  try {
    // Vérifier que le projet existe et n'est pas expiré
    const project = await projectService.findByCode(db, data.project_code)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    if (new Date(project.expires_at) < new Date()) {
      return c.json({
        success: false,
        error: 'Project has expired'
      }, 410)
    }
    
    // Vérifier la limite de commentaires
    const commentCount = await commentService.countByProject(db, data.project_code)
    if (commentCount >= project.max_comments) {
      return c.json({
        success: false,
        error: `Comment limit reached (${project.max_comments} max)`
      }, 429)
    }
    
    // Upload screenshot si fourni
    let screenshotUrl = null
    if (data.screenshot) {
      const imageId = nanoid()
      screenshotUrl = await uploadImage(bucket, imageId, data.screenshot)
    }
    
    // Créer le commentaire
    const id = nanoid()
    const comment = await commentService.create(db, {
      id,
      project_code: data.project_code,
      url: data.url,
      text: data.text,
      priority: data.priority || 'normal',
      screenshot_url: screenshotUrl,
      coordinates_x: data.coordinates?.x,
      coordinates_y: data.coordinates?.y,
      coordinates_width: data.coordinates?.width,
      coordinates_height: data.coordinates?.height,
      user_agent: data.metadata?.user_agent,
      screen_resolution: data.metadata?.screen_resolution,
      viewport_size: data.metadata?.viewport_size,
      device_type: data.metadata?.device_type
    })
    
    // Envoyer notification si configuré
    if (project.notify_email) {
      await sendNotification({
        to: project.owner_email,
        subject: `Nouveau commentaire sur ${project.name}`,
        comment,
        projectUrl: `${c.req.url.origin}/projects/${project.code}`
      })
    }
    
    // Webhook si configuré
    if (project.webhook_url) {
      // Fire and forget
      fetch(project.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'comment.created',
          project_code: project.code,
          comment
        })
      }).catch(err => console.error('Webhook failed:', err))
    }
    
    return c.json({
      success: true,
      data: {
        id: comment.id,
        created_at: comment.created_at
      }
    }, 201)
  } catch (error) {
    console.error('Error creating comment:', error)
    return c.json({
      success: false,
      error: 'Failed to create comment'
    }, 500)
  }
})

// Lister les commentaires d'un projet
commentRoutes.get('/:projectCode', validateQuery(listCommentsSchema), async (c) => {
  const projectCode = c.req.param('projectCode')
  const query = c.get('validatedQuery')
  const db = c.env.DB
  
  try {
    // Vérifier que le projet existe
    const project = await projectService.findByCode(db, projectCode)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    // Récupérer les commentaires avec filtres
    const result = await commentService.listByProject(db, projectCode, {
      status: query.status !== 'all' ? query.status : undefined,
      priority: query.priority !== 'all' ? query.priority : undefined,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sort_by,
      sortOrder: query.sort_order
    })
    
    // Enrichir avec les URLs signées pour les screenshots
    const commentsWithUrls = await Promise.all(
      result.data.map(async (comment) => {
        if (comment.screenshot_url) {
          // Générer une URL signée valide 1h
          const signedUrl = await c.env.BUCKET.createSignedUrl(
            comment.screenshot_url,
            { expiresIn: 3600 }
          )
          return { ...comment, screenshot_url: signedUrl }
        }
        return comment
      })
    )
    
    return c.json({
      success: true,
      data: commentsWithUrls,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        has_more: result.total > query.offset + query.limit
      },
      project: {
        name: project.name,
        expires_at: project.expires_at
      }
    })
  } catch (error) {
    console.error('Error listing comments:', error)
    return c.json({
      success: false,
      error: 'Failed to list comments'
    }, 500)
  }
})

// Obtenir un commentaire spécifique
commentRoutes.get('/:projectCode/:commentId', async (c) => {
  const projectCode = c.req.param('projectCode')
  const commentId = c.req.param('commentId')
  const db = c.env.DB
  
  try {
    const comment = await commentService.findById(db, commentId)
    if (!comment || comment.project_code !== projectCode) {
      return c.json({
        success: false,
        error: 'Comment not found'
      }, 404)
    }
    
    // Générer URL signée si screenshot
    if (comment.screenshot_url) {
      comment.screenshot_url = await c.env.BUCKET.createSignedUrl(
        comment.screenshot_url,
        { expiresIn: 3600 }
      )
    }
    
    return c.json({
      success: true,
      data: comment
    })
  } catch (error) {
    console.error('Error fetching comment:', error)
    return c.json({
      success: false,
      error: 'Failed to fetch comment'
    }, 500)
  }
})

// Mettre à jour un commentaire (status, priority, notes)
commentRoutes.patch('/:projectCode/:commentId', validate(updateCommentSchema), async (c) => {
  const projectCode = c.req.param('projectCode')
  const commentId = c.req.param('commentId')
  const data = c.get('validatedData')
  const db = c.env.DB
  
  try {
    // Vérifier que le commentaire existe
    const comment = await commentService.findById(db, commentId)
    if (!comment || comment.project_code !== projectCode) {
      return c.json({
        success: false,
        error: 'Comment not found'
      }, 404)
    }
    
    // Mettre à jour
    const updated = await commentService.update(db, commentId, data)
    
    // Si changement de status, notifier via webhook
    if (data.status && data.status !== comment.status) {
      const project = await projectService.findByCode(db, projectCode)
      if (project?.webhook_url) {
        fetch(project.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'comment.status_changed',
            project_code: projectCode,
            comment_id: commentId,
            old_status: comment.status,
            new_status: data.status
          })
        }).catch(err => console.error('Webhook failed:', err))
      }
    }
    
    return c.json({
      success: true,
      data: updated
    })
  } catch (error) {
    console.error('Error updating comment:', error)
    return c.json({
      success: false,
      error: 'Failed to update comment'
    }, 500)
  }
})

// Supprimer un commentaire
commentRoutes.delete('/:projectCode/:commentId', async (c) => {
  const projectCode = c.req.param('projectCode')
  const commentId = c.req.param('commentId')
  const db = c.env.DB
  const bucket = c.env.BUCKET
  
  try {
    // Vérifier existence
    const comment = await commentService.findById(db, commentId)
    if (!comment || comment.project_code !== projectCode) {
      return c.json({
        success: false,
        error: 'Comment not found'
      }, 404)
    }
    
    // Supprimer l'image si elle existe
    if (comment.screenshot_url) {
      await bucket.delete(comment.screenshot_url)
    }
    
    // Supprimer le commentaire
    await commentService.delete(db, commentId)
    
    return c.json({
      success: true,
      message: 'Comment deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return c.json({
      success: false,
      error: 'Failed to delete comment'
    }, 500)
  }
})

// Export des commentaires d'un projet
commentRoutes.get('/:projectCode/export', async (c) => {
  const projectCode = c.req.param('projectCode')
  const format = c.req.query('format') || 'json'
  const db = c.env.DB
  
  try {
    // Vérifier projet
    const project = await projectService.findByCode(db, projectCode)
    if (!project) {
      return c.json({
        success: false,
        error: 'Project not found'
      }, 404)
    }
    
    // Récupérer tous les commentaires
    const comments = await commentService.exportByProject(db, projectCode)
    
    // Formater selon le type demandé
    if (format === 'csv') {
      const csv = await commentService.toCSV(comments)
      return c.text(csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${projectCode}-comments.csv"`
      })
    } else {
      return c.json({
        project: {
          code: project.code,
          name: project.name,
          created_at: project.created_at,
          total_comments: comments.length
        },
        comments,
        exported_at: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Error exporting comments:', error)
    return c.json({
      success: false,
      error: 'Failed to export comments'
    }, 500)
  }
})
```

**Tests requis**:
- Création avec upload d'image
- Filtres et pagination
- Notifications email/webhook
- Export JSON/CSV
- URLs signées pour images

---

#### T4.4 - Gestion des erreurs et réponses standardisées
**Durée**: 3h | **Priorité**: Haute | **Dépendances**: T4.2, T4.3

**Middleware de gestion d'erreurs** (`src/middleware/errorHandler.ts`):
```typescript
import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

// Types d'erreurs personnalisées
export class ValidationError extends Error {
  constructor(public details: any) {
    super('Validation failed')
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string = 'Resource not found') {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message)
    this.name = 'RateLimitError'
  }
}

// Format de réponse standard
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  details?: any
  timestamp: string
  request_id: string
}

// Générateur de réponses
export const createResponse = <T>(
  success: boolean,
  data?: T,
  error?: string,
  details?: any
): ApiResponse<T> => {
  return {
    success,
    ...(data && { data }),
    ...(error && { error }),
    ...(details && { details }),
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID()
  }
}

// Middleware global de gestion d'erreurs
export const errorHandler = () => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      await next()
    } catch (err) {
      console.error('Error caught:', err)
      
      // HTTPException de Hono
      if (err instanceof HTTPException) {
        return c.json(
          createResponse(false, null, err.message),
          err.status
        )
      }
      
      // Erreurs de validation
      if (err instanceof ValidationError) {
        return c.json(
          createResponse(false, null, 'Validation failed', err.details),
          400
        )
      }
      
      // Ressource non trouvée
      if (err instanceof NotFoundError) {
        return c.json(
          createResponse(false, null, err.message),
          404
        )
      }
      
      // Non autorisé
      if (err instanceof UnauthorizedError) {
        return c.json(
          createResponse(false, null, err.message),
          401
        )
      }
      
      // Rate limit
      if (err instanceof RateLimitError) {
        return c.json(
          createResponse(false, null, err.message),
          429
        )
      }
      
      // Erreur de base de données
      if (err instanceof Error && err.message.includes('D1_')) {
        return c.json(
          createResponse(false, null, 'Database error'),
          500
        )
      }
      
      // Erreur générique
      return c.json(
        createResponse(false, null, 'Internal server error'),
        500
      )
    }
  }
}

// Middleware de logging
export const requestLogger = () => {
  return async (c: Context, next: () => Promise<void>) => {
    const start = Date.now()
    const requestId = crypto.randomUUID()
    
    // Ajouter l'ID de requête au contexte
    c.set('requestId', requestId)
    
    console.log({
      type: 'request',
      request_id: requestId,
      method: c.req.method,
      path: c.req.path,
      query: c.req.query(),
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
      user_agent: c.req.header('User-Agent'),
      timestamp: new Date().toISOString()
    })
    
    await next()
    
    const duration = Date.now() - start
    
    console.log({
      type: 'response',
      request_id: requestId,
      status: c.res.status,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    })
  }
}

// Helper pour les réponses de succès
export const success = <T>(c: Context, data: T, status: number = 200) => {
  return c.json(createResponse(true, data), status)
}

// Helper pour les réponses d'erreur
export const error = (c: Context, message: string, status: number = 400, details?: any) => {
  return c.json(createResponse(false, null, message, details), status)
}
```

**Intégration dans l'application** (`src/index.ts`):
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'
import { projectRoutes } from './routes/projects'
import { commentRoutes } from './routes/comments'
import { errorHandler, requestLogger } from './middleware/errorHandler'
import { rateLimiter } from './middleware/rateLimiting'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware globaux (ordre important)
app.use('*', requestLogger())
app.use('*', errorHandler())
app.use('*', secureHeaders())
app.use('*', compress())
app.use('*', cors({
  origin: (origin) => {
    // Autoriser l'extension Chrome et localhost en dev
    const allowed = [
      'chrome-extension://*',
      'http://localhost:*',
      'https://localhost:*'
    ]
    return origin // Pour l'instant on accepte tout
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Project-Code'],
  exposeHeaders: ['X-Request-ID'],
  credentials: true
}))

// Rate limiting global
app.use('/api/*', rateLimiter({
  points: 100,
  duration: 60, // par minute
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') || 'anonymous'
}))

// Routes
app.route('/api/projects', projectRoutes)
app.route('/api/comments', commentRoutes)

// Health check avec infos
app.get('/health', (c) => {
  const requestId = c.get('requestId')
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'production'
    }
  })
})

// 404 handler
app.notFound((c) => {
  return c.json(
    createResponse(false, null, 'Endpoint not found'),
    404
  )
})

export default app
```

**Tests requis**:
- Gestion de toutes les erreurs
- Format de réponse cohérent
- Logging structuré
- Headers de sécurité
- Compression activée

---

### Semaine 2: Sécurité, Performance et Infrastructure

#### T5.1 - Upload et traitement d'images optimisé
**Durée**: 5h | **Priorité**: Critique | **Dépendances**: T4.3

**Service d'upload d'images** (`src/utils/imageUpload.ts`):
```typescript
import { decode } from 'base64-arraybuffer'

interface ImageUploadOptions {
  maxSizeBytes?: number
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
}

const DEFAULT_OPTIONS: ImageUploadOptions = {
  maxSizeBytes: 5 * 1024 * 1024, // 5MB
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 85,
  format: 'webp'
}

export async function uploadImage(
  bucket: R2Bucket,
  imageId: string,
  base64Data: string,
  options: ImageUploadOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  try {
    // Extraire le type MIME et les données
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      throw new Error('Invalid base64 image format')
    }
    
    const [, mimeType, base64] = matches
    const buffer = decode(base64)
    
    // Vérifier la taille
    if (buffer.byteLength > opts.maxSizeBytes!) {
      throw new Error(`Image size exceeds limit of ${opts.maxSizeBytes! / 1024 / 1024}MB`)
    }
    
    // Optimiser l'image avec l'API Cloudflare Images (si disponible)
    // Sinon, utiliser la version originale pour l'instant
    const optimized = await optimizeImage(buffer, opts)
    
    // Générer le chemin de stockage
    const date = new Date()
    const path = `screenshots/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${imageId}.${opts.format}`
    
    // Upload vers R2
    await bucket.put(path, optimized, {
      httpMetadata: {
        contentType: `image/${opts.format}`,
        cacheControl: 'public, max-age=31536000' // 1 an
      },
      customMetadata: {
        originalFormat: mimeType,
        uploadedAt: new Date().toISOString()
      }
    })
    
    return path
  } catch (error) {
    console.error('Image upload failed:', error)
    throw new Error('Failed to upload image')
  }
}

async function optimizeImage(
  buffer: ArrayBuffer,
  options: ImageUploadOptions
): Promise<ArrayBuffer> {
  // TODO: Implémenter l'optimisation avec Cloudflare Images API
  // Pour l'instant, retourner l'image originale
  
  // Version future avec CF Images:
  // const response = await fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1', {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${CF_IMAGES_TOKEN}`
  //   },
  //   body: formData
  // })
  
  return buffer
}

// Nettoyer les anciennes images
export async function cleanupOldImages(
  bucket: R2Bucket,
  olderThanDays: number = 30
): Promise<number> {
  let deleted = 0
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
  
  try {
    // Lister les objets
    const objects = await bucket.list({
      prefix: 'screenshots/'
    })
    
    for (const object of objects.objects) {
      // Vérifier la date de création
      const uploadedAt = object.customMetadata?.uploadedAt
      if (uploadedAt && new Date(uploadedAt) < cutoffDate) {
        await bucket.delete(object.key)
        deleted++
      }
    }
    
    console.log(`Deleted ${deleted} old images`)
    return deleted
  } catch (error) {
    console.error('Cleanup failed:', error)
    return deleted
  }
}

// Générer une miniature
export async function generateThumbnail(
  bucket: R2Bucket,
  imagePath: string,
  thumbnailSize: number = 200
): Promise<string> {
  try {
    // Récupérer l'image originale
    const original = await bucket.get(imagePath)
    if (!original) {
      throw new Error('Original image not found')
    }
    
    // TODO: Implémenter la génération de miniature
    // Pour l'instant, retourner l'image originale
    
    const thumbnailPath = imagePath.replace(/\.(\w+)$/, `_thumb.webp`)
    
    // Version future:
    // const thumbnail = await resizeImage(await original.arrayBuffer(), thumbnailSize)
    // await bucket.put(thumbnailPath, thumbnail, { ... })
    
    return imagePath // Temporaire
  } catch (error) {
    console.error('Thumbnail generation failed:', error)
    return imagePath // Fallback sur l'original
  }
}
```

**Middleware de validation d'images** (`src/middleware/imageValidation.ts`):
```typescript
import { Context, Next } from 'hono'

interface ImageValidationOptions {
  maxSizeMB?: number
  allowedTypes?: string[]
  required?: boolean
}

export const validateImage = (fieldName: string = 'screenshot', options: ImageValidationOptions = {}) => {
  const {
    maxSizeMB = 5,
    allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    required = false
  } = options
  
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json()
      const imageData = body[fieldName]
      
      // Vérifier si requis
      if (!imageData && required) {
        return c.json({
          success: false,
          error: 'Image is required',
          details: { field: fieldName }
        }, 400)
      }
      
      // Si pas d'image et non requis, continuer
      if (!imageData) {
        await next()
        return
      }
      
      // Vérifier le format base64
      const matches = imageData.match(/^data:(image\/\w+);base64,(.+)$/)
      if (!matches) {
        return c.json({
          success: false,
          error: 'Invalid image format',
          details: { 
            field: fieldName,
            expected: 'data:image/[type];base64,[data]'
          }
        }, 400)
      }
      
      const [, mimeType, base64Data] = matches
      
      // Vérifier le type MIME
      if (!allowedTypes.includes(mimeType)) {
        return c.json({
          success: false,
          error: 'Invalid image type',
          details: {
            field: fieldName,
            allowed: allowedTypes,
            received: mimeType
          }
        }, 400)
      }
      
      // Estimer la taille (approximation)
      const estimatedSize = base64Data.length * 0.75
      const maxSizeBytes = maxSizeMB * 1024 * 1024
      
      if (estimatedSize > maxSizeBytes) {
        return c.json({
          success: false,
          error: 'Image too large',
          details: {
            field: fieldName,
            maxSizeMB,
            estimatedSizeMB: Math.round(estimatedSize / 1024 / 1024 * 10) / 10
          }
        }, 400)
      }
      
      await next()
    } catch (error) {
      console.error('Image validation error:', error)
      return c.json({
        success: false,
        error: 'Image validation failed'
      }, 400)
    }
  }
}
```

**Tests requis**:
- Upload avec différents formats
- Validation de taille
- Génération de chemins
- Cleanup automatique
- Gestion d'erreurs

---

#### T5.2 - Système JWT et authentification
**Durée**: 4h | **Priorité**: Haute | **Dépendances**: T4.2

**Service d'authentification** (`src/services/authService.ts`):
```typescript
import { SignJWT, jwtVerify } from 'jose'
import { NotFoundError, UnauthorizedError } from '../middleware/errorHandler'

interface JWTPayload {
  email: string
  projectCodes?: string[]
  type: 'user' | 'api_key'
  iat?: number
  exp?: number
}

export class AuthService {
  private secret: Uint8Array
  
  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey)
  }
  
  // Générer un token JWT
  async generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = '7d'): Promise<string> {
    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(this.secret)
    
    return jwt
  }
  
  // Vérifier et décoder un token
  async verifyToken(token: string): Promise<JWTPayload> {
    try {
      const { payload } = await jwtVerify(token, this.secret)
      return payload as JWTPayload
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token')
    }
  }
  
  // Générer un token d'API
  async generateApiKey(email: string, projectCodes: string[] = []): Promise<string> {
    const apiKey = await this.generateToken({
      email,
      projectCodes,
      type: 'api_key'
    }, '365d') // 1 an pour les API keys
    
    return `vfb_${btoa(apiKey).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`
  }
  
  // Décoder une API key
  async verifyApiKey(apiKey: string): Promise<JWTPayload> {
    if (!apiKey.startsWith('vfb_')) {
      throw new UnauthorizedError('Invalid API key format')
    }
    
    // Extraire le JWT encodé
    const encoded = apiKey.substring(4)
    // TODO: Implémenter le décodage inverse
    
    return this.verifyToken(encoded)
  }
  
  // Créer un magic link pour l'authentification email
  async createMagicLink(email: string, baseUrl: string): Promise<string> {
    const token = await this.generateToken({
      email,
      type: 'user'
    }, '1h') // Expire dans 1 heure
    
    return `${baseUrl}/auth/verify?token=${encodeURIComponent(token)}`
  }
}
```

**Middleware d'authentification** (`src/middleware/auth.ts`):
```typescript
import { Context, Next } from 'hono'
import { AuthService } from '../services/authService'
import { getCookie } from 'hono/cookie'

interface AuthOptions {
  optional?: boolean
  requireProjectAccess?: boolean
}

export const auth = (options: AuthOptions = {}) => {
  return async (c: Context, next: Next) => {
    const authService = new AuthService(c.env.JWT_SECRET)
    
    try {
      // Vérifier différentes sources de token
      let token: string | undefined
      
      // 1. Header Authorization
      const authHeader = c.req.header('Authorization')
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
      
      // 2. API Key header
      const apiKey = c.req.header('X-API-Key')
      if (apiKey) {
        const payload = await authService.verifyApiKey(apiKey)
        c.set('userEmail', payload.email)
        c.set('authType', 'api_key')
        c.set('allowedProjects', payload.projectCodes || [])
        await next()
        return
      }
      
      // 3. Cookie (pour le dashboard)
      if (!token) {
        token = getCookie(c, 'auth_token')
      }
      
      // Si pas de token et optionnel, continuer
      if (!token && options.optional) {
        await next()
        return
      }
      
      // Si pas de token et requis, erreur
      if (!token) {
        return c.json({
          success: false,
          error: 'Authentication required'
        }, 401)
      }
      
      // Vérifier le token
      const payload = await authService.verifyToken(token)
      
      // Ajouter les infos au contexte
      c.set('userEmail', payload.email)
      c.set('authType', payload.type)
      c.set('allowedProjects', payload.projectCodes || [])
      
      // Vérifier l'accès au projet si nécessaire
      if (options.requireProjectAccess) {
        const projectCode = c.req.param('code') || c.req.param('projectCode')
        if (projectCode && payload.projectCodes && !payload.projectCodes.includes(projectCode)) {
          return c.json({
            success: false,
            error: 'Access denied to this project'
          }, 403)
        }
      }
      
      await next()
    } catch (error) {
      console.error('Auth error:', error)
      
      if (options.optional) {
        await next()
        return
      }
      
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      }, 401)
    }
  }
}

// Middleware pour l'authentification par code projet simple
export const projectAuth = () => {
  return async (c: Context, next: Next) => {
    const projectCode = c.req.header('X-Project-Code') || c.req.query('code')
    
    if (!projectCode) {
      return c.json({
        success: false,
        error: 'Project code required'
      }, 401)
    }
    
    // Vérifier que le projet existe et n'est pas expiré
    const db = c.env.DB
    const project = await db.prepare(`
      SELECT code, expires_at, status 
      FROM projects 
      WHERE code = ? AND status = 'active'
    `).bind(projectCode).first()
    
    if (!project) {
      return c.json({
        success: false,
        error: 'Invalid project code'
      }, 401)
    }
    
    if (new Date(project.expires_at) < new Date()) {
      return c.json({
        success: false,
        error: 'Project has expired'
      }, 410)
    }
    
    c.set('projectCode', projectCode)
    await next()
  }
}
```

**Routes d'authentification** (`src/routes/auth.ts`):
```typescript
import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { AuthService } from '../services/authService'
import { validate } from '../middleware/validation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email()
})

const verifySchema = z.object({
  token: z.string()
})

export const authRoutes = new Hono<{ Bindings: { JWT_SECRET: string } }>()

// Demander un magic link
authRoutes.post('/login', validate(loginSchema), async (c) => {
  const { email } = c.get('validatedData')
  const authService = new AuthService(c.env.JWT_SECRET)
  
  try {
    // Générer le magic link
    const baseUrl = new URL(c.req.url).origin
    const magicLink = await authService.createMagicLink(email, baseUrl)
    
    // TODO: Envoyer l'email avec le lien
    console.log('Magic link:', magicLink)
    
    // Pour le dev, retourner le lien
    return c.json({
      success: true,
      message: 'Check your email for the login link',
      ...(c.env.ENVIRONMENT === 'development' && { magicLink })
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({
      success: false,
      error: 'Failed to send login link'
    }, 500)
  }
})

// Vérifier le magic link
authRoutes.get('/verify', async (c) => {
  const token = c.req.query('token')
  const authService = new AuthService(c.env.JWT_SECRET)
  
  if (!token) {
    return c.json({
      success: false,
      error: 'Token required'
    }, 400)
  }
  
  try {
    // Vérifier le token
    const payload = await authService.verifyToken(token)
    
    // Générer un nouveau token de session
    const sessionToken = await authService.generateToken({
      email: payload.email,
      type: 'user'
    })
    
    // Définir le cookie
    setCookie(c, 'auth_token', sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    })
    
    // Rediriger vers le dashboard
    return c.redirect('/dashboard')
  } catch (error) {
    console.error('Verify error:', error)
    return c.json({
      success: false,
      error: 'Invalid or expired token'
    }, 401)
  }
})

// Déconnexion
authRoutes.post('/logout', async (c) => {
  deleteCookie(c, 'auth_token')
  
  return c.json({
    success: true,
    message: 'Logged out successfully'
  })
})

// Générer une API key
authRoutes.post('/api-keys', auth(), async (c) => {
  const email = c.get('userEmail')
  const authService = new AuthService(c.env.JWT_SECRET)
  
  try {
    const apiKey = await authService.generateApiKey(email)
    
    // TODO: Sauvegarder en DB avec un hash
    
    return c.json({
      success: true,
      data: {
        api_key: apiKey,
        created_at: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('API key generation error:', error)
    return c.json({
      success: false,
      error: 'Failed to generate API key'
    }, 500)
  }
})
```

**Tests requis**:
- Génération/vérification JWT
- Magic links fonctionnels
- API keys
- Cookies sécurisés
- Gestion des expirations

---

#### T5.3 - Rate limiting et protection DDOS
**Durée**: 3h | **Priorité**: Haute | **Dépendances**: T4.4

**Middleware de rate limiting** (`src/middleware/rateLimiting.ts`):
```typescript
import { Context, Next } from 'hono'
import { RateLimitError } from './errorHandler'

interface RateLimitOptions {
  points: number          // Nombre de requêtes autorisées
  duration: number        // Durée en secondes
  keyGenerator?: (c: Context) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

interface RateLimitStore {
  increment(key: string, duration: number): Promise<number>
  reset(key: string): Promise<void>
}

// Implémentation avec KV Store
class KVRateLimitStore implements RateLimitStore {
  constructor(private kv: KVNamespace) {}
  
  async increment(key: string, duration: number): Promise<number> {
    const fullKey = `ratelimit:${key}`
    
    // Obtenir la valeur actuelle
    const current = await this.kv.get(fullKey)
    const count = current ? parseInt(current) + 1 : 1
    
    // Mettre à jour avec TTL
    await this.kv.put(fullKey, count.toString(), {
      expirationTtl: duration
    })
    
    return count
  }
  
  async reset(key: string): Promise<void> {
    await this.kv.delete(`ratelimit:${key}`)
  }
}

// Rate limiter principal
export const rateLimiter = (options: RateLimitOptions) => {
  const {
    points,
    duration,
    keyGenerator = (c) => c.req.header('CF-Connecting-IP') || 'anonymous',
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options
  
  return async (c: Context, next: Next) => {
    const kv = c.env.KV
    const store = new KVRateLimitStore(kv)
    const key = keyGenerator(c)
    
    try {
      // Incrémenter le compteur
      const count = await store.increment(key, duration)
      
      // Ajouter les headers de rate limit
      c.header('X-RateLimit-Limit', points.toString())
      c.header('X-RateLimit-Remaining', Math.max(0, points - count).toString())
      c.header('X-RateLimit-Reset', new Date(Date.now() + duration * 1000).toISOString())
      
      // Vérifier la limite
      if (count > points) {
        c.header('Retry-After', duration.toString())
        throw new RateLimitError(`Rate limit exceeded. Try again in ${duration} seconds`)
      }
      
      await next()
      
      // Optionnellement ne pas compter les requêtes réussies
      if (skipSuccessfulRequests && c.res.status < 400) {
        await store.increment(key, -1) // Décrémenter
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        return c.json({
          success: false,
          error: error.message,
          retry_after: duration
        }, 429)
      }
      
      // Laisser passer les autres erreurs
      throw error
    }
  }
}

// Rate limiter spécifique pour les endpoints sensibles
export const strictRateLimiter = rateLimiter({
  points: 5,
  duration: 300, // 5 requêtes par 5 minutes
  skipSuccessfulRequests: false
})

// Rate limiter pour l'upload d'images
export const uploadRateLimiter = rateLimiter({
  points: 20,
  duration: 3600, // 20 uploads par heure
  keyGenerator: (c) => {
    // Utiliser le code projet + IP
    const projectCode = c.get('projectCode') || 'unknown'
    const ip = c.req.header('CF-Connecting-IP') || 'anonymous'
    return `upload:${projectCode}:${ip}`
  }
})

// Protection DDOS avec Cloudflare
export const ddosProtection = () => {
  return async (c: Context, next: Next) => {
    // Vérifier les headers Cloudflare
    const cfRay = c.req.header('CF-RAY')
    const cfConnectingIP = c.req.header('CF-Connecting-IP')
    const cfIPCountry = c.req.header('CF-IPCountry')
    
    // Logger les requêtes suspectes
    if (!cfRay || !cfConnectingIP) {
      console.warn('Request without Cloudflare headers', {
        url: c.req.url,
        headers: Object.fromEntries(c.req.headers.entries())
      })
    }
    
    // Bloquer certains pays si nécessaire
    const blockedCountries = c.env.BLOCKED_COUNTRIES?.split(',') || []
    if (cfIPCountry && blockedCountries.includes(cfIPCountry)) {
      return c.json({
        success: false,
        error: 'Access denied from your location'
      }, 403)
    }
    
    // Vérifier le score de menace Cloudflare
    const threatScore = c.req.header('CF-Threat-Score')
    if (threatScore && parseInt(threatScore) > 50) {
      console.warn('High threat score detected', {
        ip: cfConnectingIP,
        score: threatScore,
        country: cfIPCountry
      })
      
      // Appliquer un rate limit plus strict
      const store = new KVRateLimitStore(c.env.KV)
      const count = await store.increment(`threat:${cfConnectingIP}`, 3600)
      
      if (count > 10) {
        return c.json({
          success: false,
          error: 'Too many requests from suspicious source'
        }, 429)
      }
    }
    
    await next()
  }
}

// Middleware de protection contre les abus
export const abuseProtection = () => {
  return async (c: Context, next: Next) => {
    const kv = c.env.KV
    const ip = c.req.header('CF-Connecting-IP') || 'anonymous'
    
    // Suivre les erreurs 4xx par IP
    await next()
    
    if (c.res.status >= 400 && c.res.status < 500) {
      const errorKey = `errors:${ip}`
      const count = await kv.get(errorKey)
      const errorCount = count ? parseInt(count) + 1 : 1
      
      await kv.put(errorKey, errorCount.toString(), {
        expirationTtl: 600 // 10 minutes
      })
      
      // Bloquer temporairement après trop d'erreurs
      if (errorCount > 50) {
        await kv.put(`blocked:${ip}`, 'true', {
          expirationTtl: 3600 // 1 heure
        })
        
        console.warn('IP blocked for too many errors', {
          ip,
          errorCount
        })
      }
    }
  }
}
```

**Configuration dans l'app** (`src/index.ts` - mise à jour):
```typescript
// Protection DDOS globale
app.use('*', ddosProtection())
app.use('*', abuseProtection())

// Rate limiting par type d'endpoint
app.use('/api/*', rateLimiter({
  points: 100,
  duration: 60
}))

app.use('/api/projects', rateLimiter({
  points: 20,
  duration: 300
}))

app.use('/api/comments', uploadRateLimiter)
app.use('/api/auth/login', strictRateLimiter)
```

**Tests requis**:
- Limites respectées
- Headers corrects
- Reset après expiration
- Protection DDOS
- Blocage IP abusives

---

#### T5.4 - Cache multi-niveaux et performance
**Durée**: 4h | **Priorité**: Haute | **Dépendances**: T5.1, T5.2

**Service de cache** (`src/services/cacheService.ts`):
```typescript
interface CacheOptions {
  ttl?: number              // Time to live en secondes
  staleWhileRevalidate?: number  // Servir le cache périmé pendant la mise à jour
  tags?: string[]           // Tags pour invalidation groupée
}

interface CacheEntry<T> {
  data: T
  expires: number
  stale?: number
  tags?: string[]
}

export class CacheService {
  constructor(
    private kv: KVNamespace,
    private defaultTTL: number = 3600
  ) {}
  
  // Obtenir une valeur du cache
  async get<T>(key: string): Promise<T | null> {
    try {
      const stored = await this.kv.get(key)
      if (!stored) return null
      
      const entry: CacheEntry<T> = JSON.parse(stored)
      const now = Date.now()
      
      // Vérifier l'expiration
      if (now > entry.expires) {
        // Si stale-while-revalidate, retourner quand même
        if (entry.stale && now < entry.stale) {
          // Marquer pour revalidation
          this.scheduleRevalidation(key)
          return entry.data
        }
        
        // Sinon, supprimer
        await this.delete(key)
        return null
      }
      
      return entry.data
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }
  
  // Stocker une valeur
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const ttl = options.ttl || this.defaultTTL
    const now = Date.now()
    
    const entry: CacheEntry<T> = {
      data: value,
      expires: now + (ttl * 1000),
      ...(options.staleWhileRevalidate && {
        stale: now + ((ttl + options.staleWhileRevalidate) * 1000)
      }),
      ...(options.tags && { tags: options.tags })
    }
    
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: ttl + (options.staleWhileRevalidate || 0)
    })
    
    // Indexer par tags si fournis
    if (options.tags) {
      for (const tag of options.tags) {
        await this.addToTagIndex(tag, key)
      }
    }
  }
  
  // Supprimer une entrée
  async delete(key: string): Promise<void> {
    await this.kv.delete(key)
  }
  
  // Invalider par tag
  async invalidateTag(tag: string): Promise<void> {
    const keys = await this.getKeysByTag(tag)
    
    // Supprimer toutes les clés avec ce tag
    await Promise.all(keys.map(key => this.delete(key)))
    
    // Nettoyer l'index
    await this.kv.delete(`tag:${tag}`)
  }
  
  // Wrapper pour mise en cache automatique
  async remember<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Vérifier le cache
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    // Sinon, exécuter la factory
    const value = await factory()
    
    // Mettre en cache
    await this.set(key, value, options)
    
    return value
  }
  
  // Cache avec verrouillage pour éviter les stampedes
  async rememberWithLock<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {},
    lockTimeout: number = 30
  ): Promise<T> {
    const lockKey = `lock:${key}`
    
    // Vérifier le cache d'abord
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }
    
    // Essayer d'acquérir le verrou
    const lockId = crypto.randomUUID()
    const locked = await this.acquireLock(lockKey, lockId, lockTimeout)
    
    if (!locked) {
      // Attendre et réessayer
      await new Promise(resolve => setTimeout(resolve, 100))
      return this.rememberWithLock(key, factory, options, lockTimeout)
    }
    
    try {
      // Double vérification après le verrou
      const cached2 = await this.get<T>(key)
      if (cached2 !== null) {
        return cached2
      }
      
      // Exécuter la factory
      const value = await factory()
      await this.set(key, value, options)
      
      return value
    } finally {
      // Libérer le verrou
      await this.releaseLock(lockKey, lockId)
    }
  }
  
  // Helpers privés
  private async addToTagIndex(tag: string, key: string): Promise<void> {
    const tagKey = `tag:${tag}`
    const existing = await this.kv.get(tagKey)
    const keys = existing ? JSON.parse(existing) : []
    
    if (!keys.includes(key)) {
      keys.push(key)
      await this.kv.put(tagKey, JSON.stringify(keys), {
        expirationTtl: 86400 // 24h
      })
    }
  }
  
  private async getKeysByTag(tag: string): Promise<string[]> {
    const tagKey = `tag:${tag}`
    const stored = await this.kv.get(tagKey)
    return stored ? JSON.parse(stored) : []
  }
  
  private async acquireLock(key: string, id: string, timeout: number): Promise<boolean> {
    try {
      // Utiliser putIfAbsent si disponible, sinon vérifier manuellement
      const existing = await this.kv.get(key)
      if (existing) return false
      
      await this.kv.put(key, id, {
        expirationTtl: timeout
      })
      
      return true
    } catch {
      return false
    }
  }
  
  private async releaseLock(key: string, id: string): Promise<void> {
    const stored = await this.kv.get(key)
    if (stored === id) {
      await this.kv.delete(key)
    }
  }
  
  private scheduleRevalidation(key: string): void {
    // TODO: Implémenter la revalidation en arrière-plan
    console.log(`Scheduled revalidation for ${key}`)
  }
}

// Décorateur pour la mise en cache des méthodes
export function Cacheable(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const cache = this.cache as CacheService
      if (!cache) {
        return originalMethod.apply(this, args)
      }
      
      // Générer une clé basée sur la méthode et les arguments
      const key = `method:${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`
      
      return cache.remember(key, () => originalMethod.apply(this, args), options)
    }
    
    return descriptor
  }
}
```

**Middleware de cache HTTP** (`src/middleware/httpCache.ts`):
```typescript
import { Context, Next } from 'hono'
import { createHash } from 'crypto'

interface HTTPCacheOptions {
  maxAge?: number           // Cache-Control max-age
  sMaxAge?: number         // Cache-Control s-maxage (CDN)
  staleWhileRevalidate?: number
  public?: boolean
  private?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
  vary?: string[]
}

export const httpCache = (options: HTTPCacheOptions = {}) => {
  return async (c: Context, next: Next) => {
    // Ne pas cacher les requêtes non-GET
    if (c.req.method !== 'GET') {
      await next()
      return
    }
    
    // Générer l'ETag basé sur le contenu
    const originalJson = c.json
    let responseData: any
    
    c.json = function (object: any, status?: number) {
      responseData = object
      const content = JSON.stringify(object)
      const etag = `"${createHash('md5').update(content).digest('hex')}"`
      
      // Vérifier If-None-Match
      const ifNoneMatch = c.req.header('If-None-Match')
      if (ifNoneMatch === etag) {
        return c.body(null, 304)
      }
      
      // Ajouter les headers de cache
      c.header('ETag', etag)
      
      // Construire Cache-Control
      const cacheControl: string[] = []
      
      if (options.noStore) {
        cacheControl.push('no-store')
      } else {
        if (options.public) cacheControl.push('public')
        if (options.private) cacheControl.push('private')
        if (options.maxAge !== undefined) cacheControl.push(`max-age=${options.maxAge}`)
        if (options.sMaxAge !== undefined) cacheControl.push(`s-maxage=${options.sMaxAge}`)
        if (options.staleWhileRevalidate !== undefined) {
          cacheControl.push(`stale-while-revalidate=${options.staleWhileRevalidate}`)
        }
        if (options.mustRevalidate) cacheControl.push('must-revalidate')
      }
      
      if (cacheControl.length > 0) {
        c.header('Cache-Control', cacheControl.join(', '))
      }
      
      // Vary headers
      if (options.vary && options.vary.length > 0) {
        c.header('Vary', options.vary.join(', '))
      }
      
      // Appeler la méthode originale
      return originalJson.call(this, object, status)
    }
    
    await next()
  }
}

// Presets de cache
export const cachePresets = {
  // Pas de cache
  noCache: httpCache({
    noStore: true
  }),
  
  // Cache court pour API dynamique
  api: httpCache({
    private: true,
    maxAge: 60,
    mustRevalidate: true
  }),
  
  // Cache moyen pour données semi-statiques
  data: httpCache({
    public: true,
    maxAge: 300,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400
  }),
  
  // Cache long pour assets
  assets: httpCache({
    public: true,
    maxAge: 31536000, // 1 an
    sMaxAge: 31536000
  })
}
```

**Tests requis**:
- Cache KV fonctionnel
- Invalidation par tags
- Lock anti-stampede
- Headers HTTP corrects
- ETags et 304

---

#### T5.5 - Nettoyage automatique (cron jobs)
**Durée**: 3h | **Priorité**: Moyenne | **Dépendances**: T5.1

**Service de nettoyage** (`src/services/cleanupService.ts`):
```typescript
import { CronJob } from '../utils/cron'

interface CleanupStats {
  projects_deleted: number
  comments_deleted: number
  images_deleted: number
  cache_cleared: number
  duration_ms: number
}

export class CleanupService {
  constructor(
    private db: D1Database,
    private bucket: R2Bucket,
    private kv: KVNamespace
  ) {}
  
  // Nettoyer les projets expirés
  async cleanupExpiredProjects(): Promise<number> {
    const now = new Date().toISOString()
    
    try {
      // Obtenir les projets expirés
      const expiredProjects = await this.db.prepare(`
        SELECT code, id 
        FROM projects 
        WHERE expires_at < ? AND status = 'active'
        LIMIT 100
      `).bind(now).all()
      
      if (!expiredProjects.results || expiredProjects.results.length === 0) {
        return 0
      }
      
      // Pour chaque projet expiré
      for (const project of expiredProjects.results) {
        await this.deleteProjectData(project.code as string)
      }
      
      // Marquer comme expirés
      const codes = expiredProjects.results.map(p => p.code)
      await this.db.prepare(`
        UPDATE projects 
        SET status = 'expired' 
        WHERE code IN (${codes.map(() => '?').join(',')})
      `).bind(...codes).run()
      
      return expiredProjects.results.length
    } catch (error) {
      console.error('Error cleaning expired projects:', error)
      return 0
    }
  }
  
  // Supprimer toutes les données d'un projet
  private async deleteProjectData(projectCode: string): Promise<void> {
    // 1. Obtenir tous les commentaires avec screenshots
    const comments = await this.db.prepare(`
      SELECT id, screenshot_url 
      FROM comments 
      WHERE project_code = ?
    `).bind(projectCode).all()
    
    // 2. Supprimer les images
    if (comments.results) {
      for (const comment of comments.results) {
        if (comment.screenshot_url) {
          try {
            await this.bucket.delete(comment.screenshot_url as string)
          } catch (err) {
            console.error(`Failed to delete image: ${comment.screenshot_url}`, err)
          }
        }
      }
    }
    
    // 3. Supprimer les commentaires
    await this.db.prepare(`
      DELETE FROM comments WHERE project_code = ?
    `).bind(projectCode).run()
    
    // 4. Invalider le cache
    await this.kv.delete(`project:${projectCode}`)
  }
  
  // Nettoyer les images orphelines
  async cleanupOrphanImages(): Promise<number> {
    let deleted = 0
    
    try {
      // Lister toutes les images
      const objects = await this.bucket.list({
        prefix: 'screenshots/',
        limit: 1000
      })
      
      if (!objects.objects || objects.objects.length === 0) {
        return 0
      }
      
      // Obtenir toutes les URLs d'images référencées
      const referenced = await this.db.prepare(`
        SELECT DISTINCT screenshot_url 
        FROM comments 
        WHERE screenshot_url IS NOT NULL
      `).all()
      
      const referencedUrls = new Set(
        referenced.results?.map(r => r.screenshot_url) || []
      )
      
      // Supprimer les non-référencées
      for (const object of objects.objects) {
        if (!referencedUrls.has(object.key)) {
          await this.bucket.delete(object.key)
          deleted++
        }
      }
      
      return deleted
    } catch (error) {
      console.error('Error cleaning orphan images:', error)
      return deleted
    }
  }
  
  // Nettoyer le cache expiré
  async cleanupExpiredCache(): Promise<number> {
    // KV gère automatiquement l'expiration avec TTL
    // Cette méthode peut être utilisée pour un nettoyage manuel si nécessaire
    
    let cleaned = 0
    
    try {
      // Nettoyer les verrous expirés
      const locks = await this.kv.list({
        prefix: 'lock:'
      })
      
      for (const key of locks.keys) {
        const value = await this.kv.get(key.name)
        if (!value) {
          await this.kv.delete(key.name)
          cleaned++
        }
      }
      
      return cleaned
    } catch (error) {
      console.error('Error cleaning cache:', error)
      return cleaned
    }
  }
  
  // Nettoyer les données de rate limiting anciennes
  async cleanupRateLimitData(): Promise<number> {
    let cleaned = 0
    
    try {
      const prefixes = ['ratelimit:', 'errors:', 'blocked:']
      
      for (const prefix of prefixes) {
        const keys = await this.kv.list({ prefix })
        
        // KV avec TTL devrait gérer ça automatiquement
        // mais on peut forcer le nettoyage si nécessaire
        for (const key of keys.keys) {
          const metadata = key.metadata as any
          if (metadata?.expiration && metadata.expiration < Date.now()) {
            await this.kv.delete(key.name)
            cleaned++
          }
        }
      }
      
      return cleaned
    } catch (error) {
      console.error('Error cleaning rate limit data:', error)
      return cleaned
    }
  }
  
  // Exécuter tous les nettoyages
  async runFullCleanup(): Promise<CleanupStats> {
    const start = Date.now()
    
    console.log('Starting full cleanup...')
    
    const [
      projects_deleted,
      images_deleted,
      cache_cleared,
      ratelimit_cleared
    ] = await Promise.all([
      this.cleanupExpiredProjects(),
      this.cleanupOrphanImages(),
      this.cleanupExpiredCache(),
      this.cleanupRateLimitData()
    ])
    
    const comments_deleted = 0 // Comptés avec les projets
    const duration_ms = Date.now() - start
    
    const stats: CleanupStats = {
      projects_deleted,
      comments_deleted,
      images_deleted,
      cache_cleared: cache_cleared + ratelimit_cleared,
      duration_ms
    }
    
    console.log('Cleanup completed:', stats)
    
    return stats
  }
  
  // Générer un rapport de santé
  async generateHealthReport(): Promise<any> {
    const [
      projectStats,
      commentStats,
      storageStats
    ] = await Promise.all([
      this.getProjectStats(),
      this.getCommentStats(),
      this.getStorageStats()
    ])
    
    return {
      timestamp: new Date().toISOString(),
      database: {
        projects: projectStats,
        comments: commentStats
      },
      storage: storageStats,
      recommendations: this.getRecommendations({
        projectStats,
        commentStats,
        storageStats
      })
    }
  }
  
  private async getProjectStats() {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired,
        COUNT(CASE WHEN expires_at < datetime('now') AND status = 'active' THEN 1 END) as pending_cleanup
      FROM projects
    `).first()
    
    return result
  }
  
  private async getCommentStats() {
    const result = await this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN screenshot_url IS NOT NULL THEN 1 END) as with_screenshots
      FROM comments
    `).first()
    
    return result
  }
  
  private async getStorageStats() {
    // Estimation basique
    const objects = await this.bucket.list({
      prefix: 'screenshots/',
      limit: 1
    })
    
    return {
      total_objects: objects.objects?.length || 0,
      estimated_size_mb: 'N/A' // R2 ne fournit pas directement la taille totale
    }
  }
  
  private getRecommendations(stats: any): string[] {
    const recommendations: string[] = []
    
    if (stats.projectStats.pending_cleanup > 10) {
      recommendations.push(`${stats.projectStats.pending_cleanup} projets expirés en attente de nettoyage`)
    }
    
    if (stats.projectStats.expired > stats.projectStats.active) {
      recommendations.push('Plus de projets expirés qu\'actifs - envisager un nettoyage complet')
    }
    
    return recommendations
  }
}
```

**Configuration des cron jobs** (`src/cron/jobs.ts`):
```typescript
import { CleanupService } from '../services/cleanupService'

// Interface pour les scheduled events de Cloudflare
interface ScheduledEvent {
  cron: string
  type: string
  scheduledTime: number
}

export async function handleScheduled(
  event: ScheduledEvent,
  env: {
    DB: D1Database
    BUCKET: R2Bucket
    KV: KVNamespace
  }
): Promise<void> {
  const cleanupService = new CleanupService(env.DB, env.BUCKET, env.KV)
  
  console.log(`Running scheduled job: ${event.cron}`)
  
  switch (event.cron) {
    // Toutes les heures : nettoyer les projets expirés
    case '0 * * * *':
      await cleanupService.cleanupExpiredProjects()
      break
    
    // Tous les jours à 3h : nettoyage complet
    case '0 3 * * *':
      await cleanupService.runFullCleanup()
      break
    
    // Tous les dimanches à 4h : rapport de santé
    case '0 4 * * 0':
      const report = await cleanupService.generateHealthReport()
      console.log('Health report:', report)
      // TODO: Envoyer par email ou webhook
      break
    
    default:
      console.warn(`Unknown cron pattern: ${event.cron}`)
  }
}
```

**Configuration dans wrangler.toml**:
```toml
# Ajouter les triggers cron
[[triggers]]
crons = ["0 * * * *", "0 3 * * *", "0 4 * * 0"]
```

**Tests requis**:
- Nettoyage projets expirés
- Suppression images orphelines
- Statistiques correctes
- Cron triggers configurés
- Logs de nettoyage

---

#### T5.6 - Monitoring et logs structurés
**Durée**: 4h | **Priorité**: Haute | **Dépendances**: T5.4, T5.5

**Service de logging** (`src/services/loggingService.ts`):
```typescript
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogContext {
  request_id?: string
  user_email?: string
  project_code?: string
  ip?: string
  user_agent?: string
  [key: string]: any
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
  duration_ms?: number
  metadata?: any
}

export class Logger {
  constructor(
    private serviceName: string,
    private minLevel: LogLevel = LogLevel.INFO
  ) {}
  
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel
  }
  
  private formatEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    metadata?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      }),
      ...(metadata && { metadata })
    }
  }
  
  private output(entry: LogEntry): void {
    // En production, utiliser le format JSON
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify({
        service: this.serviceName,
        ...entry
      }))
    } else {
      // En dev, format plus lisible
      const levelName = LogLevel[entry.level]
      console.log(`[${entry.timestamp}] ${levelName}: ${entry.message}`, entry)
    }
  }
  
  debug(message: string, context?: LogContext, metadata?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatEntry(LogLevel.DEBUG, message, context, undefined, metadata))
    }
  }
  
  info(message: string, context?: LogContext, metadata?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatEntry(LogLevel.INFO, message, context, undefined, metadata))
    }
  }
  
  warn(message: string, context?: LogContext, metadata?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatEntry(LogLevel.WARN, message, context, undefined, metadata))
    }
  }
  
  error(message: string, error?: Error, context?: LogContext, metadata?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatEntry(LogLevel.ERROR, message, context, error, metadata))
    }
  }
  
  fatal(message: string, error?: Error, context?: LogContext, metadata?: any): void {
    if (this.shouldLog(LogLevel.FATAL)) {
      this.output(this.formatEntry(LogLevel.FATAL, message, context, error, metadata))
    }
  }
  
  // Logger avec timing
  async time<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    const start = Date.now()
    
    try {
      const result = await fn()
      const duration = Date.now() - start
      
      this.info(`${operation} completed`, context, {
        duration_ms: duration,
        success: true
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - start
      
      this.error(`${operation} failed`, error as Error, context, {
        duration_ms: duration,
        success: false
      })
      
      throw error
    }
  }
  
  // Créer un child logger avec contexte
  child(context: LogContext): Logger {
    const childLogger = new Logger(this.serviceName, this.minLevel)
    const originalMethods = {
      debug: childLogger.debug.bind(childLogger),
      info: childLogger.info.bind(childLogger),
      warn: childLogger.warn.bind(childLogger),
      error: childLogger.error.bind(childLogger),
      fatal: childLogger.fatal.bind(childLogger)
    }
    
    // Override pour ajouter le contexte
    childLogger.debug = (msg, ctx?, meta?) => originalMethods.debug(msg, { ...context, ...ctx }, meta)
    childLogger.info = (msg, ctx?, meta?) => originalMethods.info(msg, { ...context, ...ctx }, meta)
    childLogger.warn = (msg, ctx?, meta?) => originalMethods.warn(msg, { ...context, ...ctx }, meta)
    childLogger.error = (msg, err?, ctx?, meta?) => originalMethods.error(msg, err, { ...context, ...ctx }, meta)
    childLogger.fatal = (msg, err?, ctx?, meta?) => originalMethods.fatal(msg, err, { ...context, ...ctx }, meta)
    
    return childLogger
  }
}

// Logger global
export const logger = new Logger('visual-feedback-api', LogLevel.INFO)
```

**Service de métriques** (`src/services/metricsService.ts`):
```typescript
interface Metric {
  name: string
  value: number
  type: 'counter' | 'gauge' | 'histogram'
  tags?: Record<string, string>
  timestamp: number
}

export class MetricsService {
  private buffer: Metric[] = []
  private flushInterval: number = 10000 // 10 secondes
  private maxBufferSize: number = 1000
  
  constructor(private analyticsEngine?: AnalyticsEngine) {
    // Flush périodiquement
    if (this.analyticsEngine) {
      setInterval(() => this.flush(), this.flushInterval)
    }
  }
  
  // Incrémenter un compteur
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    this.record({
      name,
      value,
      type: 'counter',
      tags,
      timestamp: Date.now()
    })
  }
  
  // Enregistrer une gauge (valeur absolue)
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.record({
      name,
      value,
      type: 'gauge',
      tags,
      timestamp: Date.now()
    })
  }
  
  // Enregistrer un histogram (distribution)
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.record({
      name,
      value,
      type: 'histogram',
      tags,
      timestamp: Date.now()
    })
  }
  
  // Mesurer la durée d'une opération
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = Date.now()
    
    try {
      const result = await fn()
      this.histogram(`${name}.duration`, Date.now() - start, { ...tags, status: 'success' })
      this.increment(`${name}.count`, 1, { ...tags, status: 'success' })
      return result
    } catch (error) {
      this.histogram(`${name}.duration`, Date.now() - start, { ...tags, status: 'error' })
      this.increment(`${name}.count`, 1, { ...tags, status: 'error' })
      throw error
    }
  }
  
  private record(metric: Metric): void {
    this.buffer.push(metric)
    
    // Flush si le buffer est plein
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }
  
  private async flush(): Promise<void> {
    if (!this.analyticsEngine || this.buffer.length === 0) {
      return
    }
    
    const toFlush = [...this.buffer]
    this.buffer = []
    
    try {
      // Envoyer à Analytics Engine
      for (const metric of toFlush) {
        this.analyticsEngine.writeDataPoint({
          indexes: metric.tags ? Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`) : [],
          doubles: [metric.value],
          blobs: [metric.name]
        })
      }
    } catch (error) {
      console.error('Failed to flush metrics:', error)
      // Remettre les métriques dans le buffer si l'envoi échoue
      this.buffer.unshift(...toFlush)
    }
  }
}

// Métriques prédéfinies
export class APIMetrics {
  constructor(private metrics: MetricsService) {}
  
  requestReceived(method: string, path: string): void {
    this.metrics.increment('api.requests', 1, { method, path })
  }
  
  requestCompleted(method: string, path: string, status: number, duration: number): void {
    this.metrics.histogram('api.request.duration', duration, { method, path, status: status.toString() })
    this.metrics.increment('api.responses', 1, { method, path, status: status.toString() })
  }
  
  projectCreated(): void {
    this.metrics.increment('projects.created')
  }
  
  commentCreated(priority: string): void {
    this.metrics.increment('comments.created', 1, { priority })
  }
  
  imageUploaded(size: number): void {
    this.metrics.increment('images.uploaded')
    this.metrics.histogram('images.size', size)
  }
  
  cacheHit(key: string): void {
    this.metrics.increment('cache.hits', 1, { key_prefix: key.split(':')[0] })
  }
  
  cacheMiss(key: string): void {
    this.metrics.increment('cache.misses', 1, { key_prefix: key.split(':')[0] })
  }
  
  rateLimitExceeded(ip: string): void {
    this.metrics.increment('ratelimit.exceeded')
  }
  
  authenticationFailed(reason: string): void {
    this.metrics.increment('auth.failures', 1, { reason })
  }
  
  cleanupCompleted(stats: any): void {
    this.metrics.gauge('cleanup.projects_deleted', stats.projects_deleted)
    this.metrics.gauge('cleanup.images_deleted', stats.images_deleted)
    this.metrics.histogram('cleanup.duration', stats.duration_ms)
  }
}
```

**Middleware de monitoring** (`src/middleware/monitoring.ts`):
```typescript
import { Context, Next } from 'hono'
import { Logger } from '../services/loggingService'
import { MetricsService, APIMetrics } from '../services/metricsService'

export const monitoring = (logger: Logger, metrics: MetricsService) => {
  const apiMetrics = new APIMetrics(metrics)
  
  return async (c: Context, next: Next) => {
    const start = Date.now()
    const requestId = c.get('requestId') || crypto.randomUUID()
    
    // Créer un logger avec contexte
    const requestLogger = logger.child({
      request_id: requestId,
      method: c.req.method,
      path: c.req.path,
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
      user_agent: c.req.header('User-Agent')
    })
    
    // Stocker dans le contexte
    c.set('logger', requestLogger)
    c.set('metrics', apiMetrics)
    
    // Log de la requête
    requestLogger.info('Request received', undefined, {
      query: c.req.query(),
      headers: Object.fromEntries(c.req.headers.entries())
    })
    
    // Métriques de requête
    apiMetrics.requestReceived(c.req.method, c.req.path)
    
    try {
      await next()
      
      const duration = Date.now() - start
      const status = c.res.status
      
      // Log de la réponse
      requestLogger.info('Request completed', undefined, {
        status,
        duration_ms: duration
      })
      
      // Métriques de réponse
      apiMetrics.requestCompleted(c.req.method, c.req.path, status, duration)
      
      // Ajouter des headers de debug
      c.header('X-Request-ID', requestId)
      c.header('X-Response-Time', `${duration}ms`)
      
    } catch (error) {
      const duration = Date.now() - start
      
      // Log de l'erreur
      requestLogger.error('Request failed', error as Error, undefined, {
        duration_ms: duration
      })
      
      // Métriques d'erreur
      apiMetrics.requestCompleted(c.req.method, c.req.path, 500, duration)
      
      throw error
    }
  }
}

// Helper pour accéder au logger dans les routes
export function getLogger(c: Context): Logger {
  return c.get('logger') || logger
}

// Helper pour accéder aux métriques dans les routes
export function getMetrics(c: Context): APIMetrics {
  return c.get('metrics')
}
```

**Configuration finale** (`src/index.ts` - mise à jour finale):
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { compress } from 'hono/compress'
import { secureHeaders } from 'hono/secure-headers'
import { projectRoutes } from './routes/projects'
import { commentRoutes } from './routes/comments'
import { authRoutes } from './routes/auth'
import { errorHandler, requestLogger } from './middleware/errorHandler'
import { rateLimiter, ddosProtection, abuseProtection } from './middleware/rateLimiting'
import { monitoring } from './middleware/monitoring'
import { logger } from './services/loggingService'
import { MetricsService } from './services/metricsService'
import { handleScheduled } from './cron/jobs'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
  KV: KVNamespace
  ANALYTICS: AnalyticsEngine
  JWT_SECRET: string
  ENVIRONMENT: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Initialiser les services
const metricsService = new MetricsService()

// Middleware globaux (ordre important)
app.use('*', monitoring(logger, metricsService))
app.use('*', errorHandler())
app.use('*', ddosProtection())
app.use('*', abuseProtection())
app.use('*', secureHeaders())
app.use('*', compress())
app.use('*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Project-Code', 'X-API-Key'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  credentials: true,
  maxAge: 86400
}))

// Rate limiting global
app.use('/api/*', rateLimiter({
  points: 100,
  duration: 60,
  keyGenerator: (c) => c.req.header('CF-Connecting-IP') || 'anonymous'
}))

// Routes
app.route('/api/auth', authRoutes)
app.route('/api/projects', projectRoutes)
app.route('/api/comments', commentRoutes)

// Health check avec métriques
app.get('/health', (c) => {
  const logger = getLogger(c)
  
  logger.info('Health check requested')
  
  return c.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: c.env.ENVIRONMENT || 'production',
      uptime: process.uptime ? process.uptime() : 'N/A'
    }
  })
})

// Métriques Prometheus (optionnel)
app.get('/metrics', async (c) => {
  // TODO: Exporter les métriques au format Prometheus
  return c.text('# Metrics endpoint not implemented yet')
})

// 404 handler
app.notFound((c) => {
  const logger = getLogger(c)
  logger.warn('Route not found', { path: c.req.path })
  
  return c.json({
    success: false,
    error: 'Endpoint not found'
  }, 404)
})

// Export pour Cloudflare Workers
export default {
  fetch: app.fetch,
  scheduled: handleScheduled
}
```

**Tests requis**:
- Logs structurés JSON
- Métriques collectées
- Headers de monitoring
- Analytics Engine
- Performance tracking

---

### Livrables Sprint 2

- [ ] API complète avec tous les endpoints CRUD
- [ ] Validation robuste avec Zod et messages en français
- [ ] Upload et optimisation d'images fonctionnels
- [ ] Authentification JWT et magic links
- [ ] Rate limiting et protection DDOS configurés
- [ ] Cache multi-niveaux avec KV Store
- [ ] Nettoyage automatique via cron jobs
- [ ] Logs structurés et métriques détaillées
- [ ] Tests d'intégration pour tous les endpoints
- [ ] Documentation OpenAPI/Swagger générée

**Critères de validation**:
- Tous les endpoints répondent correctement
- Upload d'images < 2 secondes
- Authentification sécurisée
- Pas de fuite mémoire
- Logs exploitables
- Performance < 100ms par requête (hors upload)

**Prochaines étapes**: Sprint 3 - Dashboard Web avec interface de gestion complète
# Plan de D�veloppement Complet - Outil de Feedback Visuel

## Vue d'ensemble du Projet

**Objectif**: Cr�er un outil de feedback visuel ultra-simplifi� permettant aux clients de laisser des commentaires contextuels sur des sites web en d�veloppement.

**Composants principaux**:
- Extension Chrome pour capture et feedback
- API Backend (Hono.js + Cloudflare Workers)
- Dashboard Web pour d�veloppeurs
- Base de donn�es D1 (SQLite)
- Stockage images R2 (Cloudflare)

**Dur�e totale**: 12 semaines (6 sprints de 2 semaines)
**�quipe**: 1-2 d�veloppeurs full-stack

---

## =� SPRINT 0 - Setup Infrastructure et Architecture (2 semaines)

### Objectifs
- Pr�parer l'environnement de d�veloppement complet
- Configurer l'infrastructure Cloudflare
- �tablir l'architecture de base du projet

### Crit�res d'acceptation
- [ ] Environnement Cloudflare Workers op�rationnel
- [ ] Base de donn�es D1 configur�e avec sch�ma initial
- [ ] Stockage R2 pour images fonctionnel
- [ ] Architecture Hono.js avec TypeScript
- [ ] CI/CD basique avec GitHub Actions
- [ ] Documentation technique de base

---

### Semaine 1: Infrastructure Backend

#### T1.1 - Configuration Cloudflare Workers
**Dur�e**: 4h | **Priorit�**: Critique | **D�pendances**: Aucune

**D�tails techniques**:
```bash
# Installation et configuration
npm create cloudflare@latest visual-feedback-api
cd visual-feedback-api
npm install hono @hono/node-server
npm install -D @types/node typescript wrangler
```

**Fichiers � cr�er**:
- `wrangler.toml` - Configuration Cloudflare
- `src/index.ts` - Point d'entr�e API
- `package.json` - D�pendances et scripts
- `.gitignore` - Exclusions git

**Configuration wrangler.toml**:
```toml
name = "visual-feedback-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
name = "visual-feedback-api-prod"

[[d1_databases]]
binding = "DB"
database_name = "visual-feedback-db"
database_id = "xxx"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "visual-feedback-images"
```

**Tests requis**:
- D�ploiement r�ussi sur Cloudflare
- Endpoint de sant� fonctionnel
- Variables d'environnement accessibles

---

#### T1.2 - Setup Cloudflare D1 Database
**Dur�e**: 3h | **Priorit�**: Critique | **D�pendances**: T1.1

**Commandes de cr�ation**:
```bash
wrangler d1 create visual-feedback-db
wrangler d1 execute visual-feedback-db --file=./schema.sql
```

**Sch�ma de base de donn�es** (`schema.sql`):
```sql
-- Table des projets
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    owner_email TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    max_comments INTEGER DEFAULT 100,
    notify_email BOOLEAN DEFAULT 0,
    webhook_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired'))
);

-- Table des commentaires
CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    project_code TEXT NOT NULL,
    url TEXT NOT NULL,
    text TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    screenshot_url TEXT,
    coordinates_x INTEGER,
    coordinates_y INTEGER,
    coordinates_width INTEGER,
    coordinates_height INTEGER,
    user_agent TEXT,
    screen_resolution TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
    FOREIGN KEY (project_code) REFERENCES projects(code)
);

-- Index pour performance
CREATE INDEX idx_comments_project_code ON comments(project_code);
CREATE INDEX idx_comments_status ON comments(status);
CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_owner ON projects(owner_email);
```

**Tests requis**:
- Cr�ation tables r�ussie
- Insertion test donn�es
- Requ�tes de base fonctionnelles

---

#### T1.3 - Configuration Cloudflare R2
**Dur�e**: 2h | **Priorit�**: Critique | **D�pendances**: T1.1

**Commandes de cr�ation**:
```bash
wrangler r2 bucket create visual-feedback-images
```

**Configuration CORS** (`cors.json`):
```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

**Tests requis**:
- Upload fichier test r�ussi
- R�cup�ration fichier via URL publique
- Suppression fichier fonctionnelle

---

#### T1.4 - Architecture Hono.js
**Dur�e**: 4h | **Priorit�**: Critique | **D�pendances**: T1.1, T1.2

**Structure de dossiers**:
```
src/
   index.ts              # Point d'entr�e
   types/               # Types TypeScript
      project.ts
      comment.ts
   routes/              # Routes API
      projects.ts
      comments.ts
   middleware/          # Middleware
      cors.ts
      auth.ts
      rateLimiting.ts
   services/           # Logique m�tier
      projectService.ts
      commentService.ts
   utils/              # Utilitaires
       crypto.ts
       validation.ts
```

**Point d'entr�e** (`src/index.ts`):
```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { projectRoutes } from './routes/projects'
import { commentRoutes } from './routes/comments'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// Middleware global
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Routes
app.route('/api/projects', projectRoutes)
app.route('/api/comments', commentRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'OK', timestamp: new Date().toISOString() }))

export default app
```

**Tests requis**:
- Compilation TypeScript sans erreur
- D�ploiement r�ussi
- Endpoints de base accessibles

---

### Semaine 2: Mod�le de Donn�es et API Foundation

#### T2.1 - Types TypeScript
**Dur�e**: 3h | **Priorit�**: Haute | **D�pendances**: T1.4

**Types de base** (`src/types/project.ts`):
```typescript
export interface Project {
  id: string
  code: string
  name: string
  owner_email: string
  created_at: string
  expires_at: string
  max_comments: number
  notify_email: boolean
  webhook_url?: string
  status: 'active' | 'inactive' | 'expired'
}

export interface CreateProjectRequest {
  name: string
  owner_email: string
  max_comments?: number
  notify_email?: boolean
  webhook_url?: string
}

export interface ProjectResponse {
  id: string
  code: string
  name: string
  expires_at: string
  max_comments: number
}
```

**Types commentaires** (`src/types/comment.ts`):
```typescript
export interface Comment {
  id: string
  project_code: string
  url: string
  text: string
  priority: 'low' | 'normal' | 'high'
  screenshot_url?: string
  coordinates_x?: number
  coordinates_y?: number
  coordinates_width?: number
  coordinates_height?: number
  user_agent?: string
  screen_resolution?: string
  created_at: string
  status: 'new' | 'in_progress' | 'resolved'
}

export interface CreateCommentRequest {
  project_code: string
  url: string
  text: string
  priority?: 'low' | 'normal' | 'high'
  screenshot?: string // Base64
  coordinates?: {
    x: number
    y: number
    width: number
    height: number
  }
  metadata?: {
    user_agent?: string
    screen_resolution?: string
  }
}
```

---

#### T2.2 - Syst�me de g�n�ration de codes
**Dur�e**: 2h | **Priorit�**: Haute | **D�pendances**: T2.1

**Utilitaire crypto** (`src/utils/crypto.ts`):
```typescript
export function generateProjectCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const sections = 3
  const sectionLength = 3
  
  const sections_array = []
  
  for (let i = 0; i < sections; i++) {
    let section = ''
    for (let j = 0; j < sectionLength; j++) {
      section += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    sections_array.push(section)
  }
  
  return sections_array.join('-') // Format: ABC-123-XYZ
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function hashProjectCode(code: string): string {
  // Pour validation s�curis�e
  const encoder = new TextEncoder()
  const data = encoder.encode(code)
  return crypto.subtle.digest('SHA-256', data)
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''))
}
```

**Tests requis**:
- G�n�ration codes uniques
- Format correct (XXX-XXX-XXX)
- Collision test (1000 g�n�rations)

---

#### T2.3 - Services m�tier
**Dur�e**: 6h | **Priorit�**: Haute | **D�pendances**: T2.1, T2.2

**Service projets** (`src/services/projectService.ts`):
```typescript
import { Project, CreateProjectRequest, ProjectResponse } from '../types/project'
import { generateProjectCode, generateId } from '../utils/crypto'

export class ProjectService {
  constructor(private db: D1Database) {}

  async createProject(data: CreateProjectRequest): Promise<ProjectResponse> {
    const id = generateId()
    const code = generateProjectCode()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 jours par d�faut

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, code, name, owner_email, expires_at, max_comments, notify_email, webhook_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await stmt.bind(
      id,
      code,
      data.name,
      data.owner_email,
      expiresAt.toISOString(),
      data.max_comments || 100,
      data.notify_email || false,
      data.webhook_url || null
    ).run()

    return {
      id,
      code,
      name: data.name,
      expires_at: expiresAt.toISOString(),
      max_comments: data.max_comments || 100
    }
  }

  async getProjectByCode(code: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE code = ? AND status = "active"')
    const result = await stmt.bind(code).first()
    
    if (!result) return null
    
    // V�rifier expiration
    if (new Date(result.expires_at as string) < new Date()) {
      await this.expireProject(code)
      return null
    }
    
    return result as Project
  }

  async expireProject(code: string): Promise<void> {
    const stmt = this.db.prepare('UPDATE projects SET status = "expired" WHERE code = ?')
    await stmt.bind(code).run()
  }

  async updateProject(code: string, updates: Partial<Project>): Promise<boolean> {
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ')
    const values = Object.values(updates)
    
    const stmt = this.db.prepare(`UPDATE projects SET ${setClause} WHERE code = ?`)
    const result = await stmt.bind(...values, code).run()
    
    return result.changes > 0
  }
}
```

**Service commentaires** (`src/services/commentService.ts`):
```typescript
import { Comment, CreateCommentRequest } from '../types/comment'
import { generateId } from '../utils/crypto'

export class CommentService {
  constructor(private db: D1Database, private bucket: R2Bucket) {}

  async createComment(data: CreateCommentRequest): Promise<string> {
    const id = generateId()
    let screenshotUrl = null

    // Upload screenshot si fourni
    if (data.screenshot) {
      screenshotUrl = await this.uploadScreenshot(id, data.screenshot)
    }

    const stmt = this.db.prepare(`
      INSERT INTO comments (
        id, project_code, url, text, priority, screenshot_url,
        coordinates_x, coordinates_y, coordinates_width, coordinates_height,
        user_agent, screen_resolution
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    await stmt.bind(
      id,
      data.project_code,
      data.url,
      data.text,
      data.priority || 'normal',
      screenshotUrl,
      data.coordinates?.x || null,
      data.coordinates?.y || null,
      data.coordinates?.width || null,
      data.coordinates?.height || null,
      data.metadata?.user_agent || null,
      data.metadata?.screen_resolution || null
    ).run()

    return id
  }

  async getCommentsByProject(projectCode: string, status?: string): Promise<Comment[]> {
    let query = 'SELECT * FROM comments WHERE project_code = ?'
    const params = [projectCode]

    if (status) {
      query += ' AND status = ?'
      params.push(status)
    }

    query += ' ORDER BY created_at DESC'

    const stmt = this.db.prepare(query)
    const results = await stmt.bind(...params).all()
    
    return results.results as Comment[]
  }

  async updateCommentStatus(id: string, status: 'new' | 'in_progress' | 'resolved'): Promise<boolean> {
    const stmt = this.db.prepare('UPDATE comments SET status = ? WHERE id = ?')
    const result = await stmt.bind(status, id).run()
    
    return result.changes > 0
  }

  private async uploadScreenshot(commentId: string, base64Image: string): Promise<string> {
    // D�coder base64
    const imageData = Uint8Array.from(atob(base64Image), c => c.charCodeAt(0))
    
    // Nom du fichier
    const fileName = `screenshots/${commentId}.webp`
    
    // Upload vers R2
    await this.bucket.put(fileName, imageData, {
      httpMetadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000'
      }
    })

    return fileName
  }

  async deleteComment(id: string): Promise<boolean> {
    // Supprimer screenshot d'abord
    const comment = await this.getCommentById(id)
    if (comment?.screenshot_url) {
      await this.bucket.delete(comment.screenshot_url)
    }

    // Supprimer de la DB
    const stmt = this.db.prepare('DELETE FROM comments WHERE id = ?')
    const result = await stmt.bind(id).run()
    
    return result.changes > 0
  }

  private async getCommentById(id: string): Promise<Comment | null> {
    const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?')
    const result = await stmt.bind(id).first()
    return result as Comment || null
  }
}
```

---

#### T2.4 - Routes API de base
**Dur�e**: 4h | **Priorit�**: Haute | **D�pendances**: T2.3

**Routes projets** (`src/routes/projects.ts`):
```typescript
import { Hono } from 'hono'
import { ProjectService } from '../services/projectService'
import { CreateProjectRequest } from '../types/project'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

export const projectRoutes = new Hono<{ Bindings: Bindings }>()

// POST /api/projects - Cr�er un projet
projectRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CreateProjectRequest
    
    // Validation
    if (!body.name || !body.owner_email) {
      return c.json({ error: 'Name and owner_email are required' }, 400)
    }

    const projectService = new ProjectService(c.env.DB)
    const project = await projectService.createProject(body)
    
    return c.json(project, 201)
  } catch (error) {
    console.error('Error creating project:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/projects/:code - Valider un code projet
projectRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    
    if (!code || !/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    const projectService = new ProjectService(c.env.DB)
    const project = await projectService.getProjectByCode(code)
    
    if (!project) {
      return c.json({ error: 'Project not found or expired' }, 404)
    }

    return c.json({
      id: project.id,
      name: project.name,
      code: project.code,
      expires_at: project.expires_at,
      max_comments: project.max_comments
    })
  } catch (error) {
    console.error('Error validating project:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/projects/:code - Mettre � jour un projet
projectRoutes.put('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const updates = await c.req.json()
    
    const projectService = new ProjectService(c.env.DB)
    const success = await projectService.updateProject(code, updates)
    
    if (!success) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating project:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
```

**Routes commentaires** (`src/routes/comments.ts`):
```typescript
import { Hono } from 'hono'
import { CommentService } from '../services/commentService'
import { ProjectService } from '../services/projectService'
import { CreateCommentRequest } from '../types/comment'

type Bindings = {
  DB: D1Database
  BUCKET: R2Bucket
}

export const commentRoutes = new Hono<{ Bindings: Bindings }>()

// POST /api/comments - Cr�er un commentaire
commentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CreateCommentRequest
    
    // Validation
    if (!body.project_code || !body.url || !body.text) {
      return c.json({ error: 'project_code, url, and text are required' }, 400)
    }

    // V�rifier que le projet existe
    const projectService = new ProjectService(c.env.DB)
    const project = await projectService.getProjectByCode(body.project_code)
    
    if (!project) {
      return c.json({ error: 'Invalid project code' }, 400)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const commentId = await commentService.createComment(body)
    
    return c.json({ id: commentId, status: 'success' }, 201)
  } catch (error) {
    console.error('Error creating comment:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/comments/:code - Lister commentaires d'un projet
commentRoutes.get('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const status = c.req.query('status')
    
    // V�rifier que le projet existe
    const projectService = new ProjectService(c.env.DB)
    const project = await projectService.getProjectByCode(code)
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const comments = await commentService.getCommentsByProject(code, status)
    
    return c.json({
      comments,
      total: comments.length,
      project: {
        id: project.id,
        name: project.name,
        code: project.code
      }
    })
  } catch (error) {
    console.error('Error fetching comments:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/comments/:id/status - Mettre � jour statut commentaire
commentRoutes.put('/:id/status', async (c) => {
  try {
    const id = c.req.param('id')
    const { status } = await c.req.json()
    
    if (!['new', 'in_progress', 'resolved'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const success = await commentService.updateCommentStatus(id, status)
    
    if (!success) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating comment status:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/comments/:id - Supprimer commentaire
commentRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const success = await commentService.deleteComment(id)
    
    if (!success) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
```

---

#### T2.5 - Middleware et s�curit�
**Dur�e**: 3h | **Priorit�**: Haute | **D�pendances**: T2.4

**Middleware CORS** (`src/middleware/cors.ts`):
```typescript
import { createMiddleware } from 'hono/factory'

export const corsMiddleware = createMiddleware(async (c, next) => {
  // Headers CORS pour extension Chrome
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Max-Age', '86400')

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204)
  }

  await next()
})
```

**Rate Limiting** (`src/middleware/rateLimiting.ts`):
```typescript
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

    // Nettoyer les entr�es expir�es
    Object.keys(store).forEach(key => {
      if (store[key].resetTime < windowStart) {
        delete store[key]
      }
    })

    // V�rifier limite pour cette IP
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
```

**Validation** (`src/utils/validation.ts`):
```typescript
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateProjectCode(code: string): boolean {
  const codeRegex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
  return codeRegex.test(code)
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Supprimer balises
    .trim()
    .substring(0, 1000) // Limiter longueur
}

export function validateCommentData(data: any): string[] {
  const errors: string[] = []

  if (!data.project_code || !validateProjectCode(data.project_code)) {
    errors.push('Invalid project code')
  }

  if (!data.url || !validateUrl(data.url)) {
    errors.push('Invalid URL')
  }

  if (!data.text || data.text.trim().length === 0) {
    errors.push('Comment text is required')
  }

  if (data.text && data.text.length > 1000) {
    errors.push('Comment text too long (max 1000 characters)')
  }

  if (data.priority && !['low', 'normal', 'high'].includes(data.priority)) {
    errors.push('Invalid priority')
  }

  return errors
}
```

---

#### T2.6 - Tests et CI/CD
**Dur�e**: 4h | **Priorit�**: Moyenne | **D�pendances**: T2.5

**Configuration Vitest** (`vitest.config.ts`):
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '*.config.*']
    }
  }
})
```

**Tests unitaires** (`tests/services/projectService.test.ts`):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from '../../src/services/projectService'

// Mock D1Database
const mockDB = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn(),
      first: vi.fn(),
      all: vi.fn()
    }))
  }))
} as any

describe('ProjectService', () => {
  let projectService: ProjectService

  beforeEach(() => {
    projectService = new ProjectService(mockDB)
    vi.clearAllMocks()
  })

  describe('createProject', () => {
    it('should create a project with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        owner_email: 'test@example.com'
      }

      const result = await projectService.createProject(projectData)

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('code')
      expect(result.name).toBe(projectData.name)
      expect(mockDB.prepare).toHaveBeenCalled()
    })

    it('should generate unique project codes', async () => {
      const projectData = {
        name: 'Test Project',
        owner_email: 'test@example.com'
      }

      const result1 = await projectService.createProject(projectData)
      const result2 = await projectService.createProject(projectData)

      expect(result1.code).not.toBe(result2.code)
    })
  })

  describe('getProjectByCode', () => {
    it('should return null for non-existent code', async () => {
      mockDB.prepare().bind().first.mockResolvedValue(null)

      const result = await projectService.getProjectByCode('ABC-123-XYZ')

      expect(result).toBeNull()
    })

    it('should return project for valid code', async () => {
      const mockProject = {
        id: '123',
        code: 'ABC-123-XYZ',
        name: 'Test Project',
        expires_at: new Date(Date.now() + 86400000).toISOString()
      }
      
      mockDB.prepare().bind().first.mockResolvedValue(mockProject)

      const result = await projectService.getProjectByCode('ABC-123-XYZ')

      expect(result).toEqual(mockProject)
    })
  })
})
```

**GitHub Actions** (`.github/workflows/ci.yml`):
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run tests
      run: npm run test:coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/coverage-final.json

  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to staging
      run: npm run deploy:staging
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        
  deploy-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Deploy to production
      run: npm run deploy:production
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Scripts package.json**:
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler publish",
    "deploy:staging": "wrangler publish --env staging",
    "deploy:production": "wrangler publish --env production",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "type-check": "tsc --noEmit"
  }
}
```

---

### Livrables Sprint 0
- [ ] Infrastructure Cloudflare op�rationnelle
- [ ] Base de donn�es D1 avec sch�ma complet
- [ ] API Hono.js avec endpoints de base
- [ ] Services m�tier fonctionnels
- [ ] Tests unitaires (coverage > 80%)
- [ ] CI/CD pipeline configur�
- [ ] Documentation technique de base

**Crit�res de validation**:
- D�ploiement API r�ussi sur Cloudflare Workers
- Endpoints /health, /api/projects, /api/comments fonctionnels
- Tests passent sans erreur
- Code quality gates respect�s (ESLint, TypeScript)

---

## <� SPRINT 1 - Extension Chrome Foundation (2 semaines)

### Objectifs
- Cr�er l'extension Chrome avec Manifest V3
- Impl�menter l'interface popup de base
- D�velopper les content scripts pour capture
- �tablir la communication entre composants

### Crit�res d'acceptation
- [ ] Extension installable depuis fichier local
- [ ] Interface popup fonctionnelle
- [ ] Capture d'�cran de base op�rationnelle
- [ ] Communication avec API backend
- [ ] Stockage local s�curis� des codes
- [ ] Tests automatis�s

---

### Semaine 1: Structure Extension et Interface

#### T3.1 - Configuration Manifest V3
**Dur�e**: 3h | **Priorit�**: Critique | **D�pendances**: Aucune

**Structure de dossiers**:
```
extension/
   manifest.json           # Configuration extension
   popup/                  # Interface popup
      popup.html
      popup.css
      popup.js
      popup.ts
   content/                # Scripts de contenu
      content.js
      content.ts
      overlay.css
   background/             # Service worker
      background.js
      background.ts
   assets/                 # Ressources
      icons/
         icon16.png
         icon48.png
         icon128.png
      images/
   types/                  # Types TypeScript
      extension.d.ts
   utils/                  # Utilitaires
      storage.ts
      api.ts
      validation.ts
   tests/                  # Tests
      unit/
      e2e/
   build/                  # Build output
   webpack.config.js
   package.json
   tsconfig.json
```

**Manifest.json**:
```json
{
  "manifest_version": 3,
  "name": "Visual Feedback Tool",
  "version": "1.0.0",
  "description": "Outil de feedback visuel simple pour d�veloppeurs et clients",
  
  "permissions": [
    "activeTab",
    "storage",
    "tabs"
  ],
  
  "host_permissions": [
    "<all_urls>"
  ],
  
  "background": {
    "service_worker": "background/background.js",
    "type": "module"
  },
  
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "css": ["content/overlay.css"],
      "run_at": "document_end"
    }
  ],
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Visual Feedback Tool",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "assets/icons/icon16.png",
    "48": "assets/icons/icon48.png",
    "128": "assets/icons/icon128.png"
  },
  
  "web_accessible_resources": [
    {
      "resources": ["assets/images/*"],
      "matches": ["<all_urls>"]
    }
  ],
  
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

**Types Extension** (`types/extension.d.ts`):
```typescript
// Types pour l'extension Chrome
export interface ProjectData {
  id: string
  code: string
  name: string
  expires_at: string
  isActive: boolean
}

export interface CommentData {
  projectCode: string
  url: string
  text: string
  priority: 'low' | 'normal' | 'high'
  screenshot?: string
  coordinates?: {
    x: number
    y: number
    width: number
    height: number
  }
  metadata: {
    userAgent: string
    screenResolution: string
    timestamp: string
  }
}

export interface ExtensionSettings {
  captureMode: 'overlay' | 'keyboard' | 'both'
  overlayPosition: 'top-right' | 'bottom-left' | 'bottom-right'
  keyboardShortcut: string
  overlaySize: 'small' | 'medium' | 'large'
  apiEndpoint: string
}

export interface StorageData {
  currentProject?: ProjectData
  settings: ExtensionSettings
  recentComments: CommentData[]
}

// Messages entre composants
export interface ExtensionMessage {
  type: 'CAPTURE_SCREENSHOT' | 'SAVE_COMMENT' | 'UPDATE_PROJECT' | 'SHOW_OVERLAY' | 'HIDE_OVERLAY'
  data?: any
}
```

---

#### T3.2 - Interface Popup
**Dur�e**: 5h | **Priorit�**: Haute | **D�pendances**: T3.1

**Popup HTML** (`popup/popup.html`):
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual Feedback Tool</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <!-- Header -->
    <header class="popup-header">
      <div class="logo">
        <span class="icon">=%</span>
        <h1>Feedback Tool</h1>
      </div>
      <button class="settings-btn" id="settingsBtn">�</button>
    </header>

    <!-- �tat d�connect� -->
    <div class="disconnected-state" id="disconnectedState">
      <div class="connect-section">
        <h2>Connectez-vous � un projet</h2>
        <div class="code-input-group">
          <input 
            type="text" 
            id="projectCodeInput" 
            placeholder="ABC-123-XYZ"
            class="code-input"
            maxlength="11"
          >
          <button id="connectBtn" class="connect-btn">
            <span class="btn-text">Connecter</span>
            <span class="btn-loader hidden">=</span>
          </button>
        </div>
        <div class="error-message hidden" id="errorMessage"></div>
        <div class="help-text">
          Saisissez le code projet fourni par votre d�veloppeur
        </div>
      </div>
    </div>

    <!-- �tat connect� -->
    <div class="connected-state hidden" id="connectedState">
      <div class="project-info">
        <div class="project-badge">
          <span class="status-indicator"></span>
          <div class="project-details">
            <div class="project-code" id="currentProjectCode">ABC-123-XYZ</div>
            <div class="project-name" id="currentProjectName">Nom du projet</div>
          </div>
          <button class="disconnect-btn" id="disconnectBtn"></button>
        </div>
      </div>

      <div class="actions-section">
        <button class="action-btn primary" id="captureBtn">
          <span class="btn-icon">=�</span>
          <span class="btn-label">Nouvelle capture</span>
        </button>
        
        <button class="action-btn secondary" id="viewCommentsBtn">
          <span class="btn-icon">=�</span>
          <span class="btn-label">Mes commentaires</span>
          <span class="comment-count" id="commentCount">3</span>
        </button>
      </div>

      <div class="recent-comments" id="recentComments">
        <h3>Commentaires r�cents</h3>
        <div class="comments-list" id="commentsList">
          <!-- Commentaires g�n�r�s dynamiquement -->
        </div>
      </div>
    </div>

    <!-- Param�tres -->
    <div class="settings-panel hidden" id="settingsPanel">
      <div class="settings-header">
        <h2>Param�tres</h2>
        <button class="close-btn" id="closeSettingsBtn"></button>
      </div>
      
      <div class="settings-content">
        <div class="setting-group">
          <label>Mode de capture</label>
          <select id="captureModeSelect">
            <option value="overlay">Overlay flottant</option>
            <option value="keyboard">Raccourci clavier</option>
            <option value="both">Les deux</option>
          </select>
        </div>

        <div class="setting-group">
          <label>Position de l'overlay</label>
          <select id="overlayPositionSelect">
            <option value="top-right">Coin sup�rieur droit</option>
            <option value="bottom-right">Coin inf�rieur droit</option>
            <option value="bottom-left">Coin inf�rieur gauche</option>
          </select>
        </div>

        <div class="setting-group">
          <label>Taille de l'overlay</label>
          <select id="overlaySizeSelect">
            <option value="small">Petit</option>
            <option value="medium">Moyen</option>
            <option value="large">Grand</option>
          </select>
        </div>

        <div class="setting-group">
          <label>Raccourci clavier</label>
          <input type="text" id="keyboardShortcutInput" readonly placeholder="Ctrl+Shift+C">
          <button class="record-shortcut-btn" id="recordShortcutBtn">Modifier</button>
        </div>
      </div>

      <div class="settings-footer">
        <button class="save-settings-btn" id="saveSettingsBtn">Sauvegarder</button>
      </div>
    </div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

**Popup CSS** (`popup/popup.css`):
```css
/* Reset et base */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  width: 360px;
  min-height: 400px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.4;
  color: #1a1a1a;
  background: #ffffff;
}

/* Container principal */
.popup-container {
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

/* Header */
.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo .icon {
  font-size: 20px;
}

.logo h1 {
  font-size: 16px;
  font-weight: 600;
}

.settings-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  padding: 6px;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* �tat d�connect� */
.disconnected-state {
  padding: 24px 16px;
  text-align: center;
}

.disconnected-state h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 20px;
  color: #1a1a1a;
}

.code-input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.code-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
  letter-spacing: 1px;
  transition: border-color 0.2s;
}

.code-input:focus {
  outline: none;
  border-color: #667eea;
}

.connect-btn {
  padding: 12px 16px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  min-width: 80px;
}

.connect-btn:hover {
  background: #5a67d8;
}

.connect-btn:disabled {
  background: #a0aec0;
  cursor: not-allowed;
}

.btn-loader {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.error-message {
  color: #ef4444;
  font-size: 12px;
  margin-bottom: 8px;
  padding: 8px;
  background: #fef2f2;
  border-radius: 6px;
  border-left: 3px solid #ef4444;
}

.help-text {
  color: #6b7280;
  font-size: 12px;
}

/* �tat connect� */
.connected-state {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.project-info {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.project-badge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border-radius: 8px;
  border-left: 4px solid #10b981;
}

.status-indicator {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
}

.project-details {
  flex: 1;
}

.project-code {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a1a;
}

.project-name {
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.disconnect-btn {
  background: none;
  border: none;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.disconnect-btn:hover {
  background: #e5e7eb;
}

/* Actions */
.actions-section {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  font-weight: 500;
}

.action-btn.primary {
  background: #667eea;
  color: white;
}

.action-btn.primary:hover {
  background: #5a67d8;
}

.action-btn.secondary {
  background: #f8fafc;
  color: #1a1a1a;
  border: 1px solid #e5e7eb;
  justify-content: space-between;
}

.action-btn.secondary:hover {
  background: #f1f5f9;
}

.btn-icon {
  font-size: 16px;
}

.comment-count {
  background: #667eea;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

/* Commentaires r�cents */
.recent-comments {
  flex: 1;
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.recent-comments h3 {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #1a1a1a;
}

.comments-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-item {
  padding: 10px;
  background: #f8fafc;
  border-radius: 6px;
  border-left: 3px solid #e5e7eb;
}

.comment-item.priority-high {
  border-left-color: #ef4444;
}

.comment-item.priority-normal {
  border-left-color: #f59e0b;
}

.comment-item.priority-low {
  border-left-color: #10b981;
}

.comment-text {
  font-size: 12px;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.comment-meta {
  font-size: 10px;
  color: #6b7280;
}

/* Param�tres */
.settings-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: white;
  z-index: 100;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.settings-header h2 {
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #6b7280;
}

.close-btn:hover {
  background: #f3f4f6;
}

.settings-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-group label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.setting-group select,
.setting-group input {
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.record-shortcut-btn {
  margin-top: 4px;
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 11px;
  cursor: pointer;
}

.settings-footer {
  padding: 16px;
  border-top: 1px solid #e5e7eb;
}

.save-settings-btn {
  width: 100%;
  padding: 12px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
}

.save-settings-btn:hover {
  background: #5a67d8;
}

/* Utilitaires */
.hidden {
  display: none !important;
}

.loading {
  opacity: 0.6;
  pointer-events: none;
}
```

---

#### T3.3 - Logique Popup TypeScript
**Dur�e**: 6h | **Priorit�**: Haute | **D�pendances**: T3.2

**Utilitaires Storage** (`utils/storage.ts`):
```typescript
import { StorageData, ExtensionSettings, ProjectData } from '../types/extension'

const DEFAULT_SETTINGS: ExtensionSettings = {
  captureMode: 'overlay',
  overlayPosition: 'top-right',
  keyboardShortcut: 'Ctrl+Shift+C',
  overlaySize: 'medium',
  apiEndpoint: 'https://visual-feedback-api.workers.dev'
}

export class ExtensionStorage {
  static async get<T>(key: keyof StorageData): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key)
      return result[key] || null
    } catch (error) {
      console.error('Storage get error:', error)
      return null
    }
  }

  static async set<T>(key: keyof StorageData, value: T): Promise<boolean> {
    try {
      await chrome.storage.local.set({ [key]: value })
      return true
    } catch (error) {
      console.error('Storage set error:', error)
      return false
    }
  }

  static async remove(key: keyof StorageData): Promise<boolean> {
    try {
      await chrome.storage.local.remove(key)
      return true
    } catch (error) {
      console.error('Storage remove error:', error)
      return false
    }
  }

  static async clear(): Promise<boolean> {
    try {
      await chrome.storage.local.clear()
      return true
    } catch (error) {
      console.error('Storage clear error:', error)
      return false
    }
  }

  static async getSettings(): Promise<ExtensionSettings> {
    const settings = await this.get<ExtensionSettings>('settings')
    return { ...DEFAULT_SETTINGS, ...settings }
  }

  static async saveSettings(settings: Partial<ExtensionSettings>): Promise<boolean> {
    const currentSettings = await this.getSettings()
    const newSettings = { ...currentSettings, ...settings }
    return this.set('settings', newSettings)
  }

  static async getCurrentProject(): Promise<ProjectData | null> {
    return this.get<ProjectData>('currentProject')
  }

  static async setCurrentProject(project: ProjectData): Promise<boolean> {
    return this.set('currentProject', project)
  }

  static async clearCurrentProject(): Promise<boolean> {
    return this.remove('currentProject')
  }
}
```

**API Client** (`utils/api.ts`):
```typescript
import { ExtensionStorage } from './storage'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export class ApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'https://visual-feedback-api.workers.dev'
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`
        }
      }

      return {
        success: true,
        data
      }
    } catch (error) {
      console.error('API request error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      }
    }
  }

  async validateProjectCode(code: string) {
    return this.request(`/api/projects/${code}`)
  }

  async createComment(commentData: any) {
    return this.request('/api/comments', {
      method: 'POST',
      body: JSON.stringify(commentData)
    })
  }

  async getComments(projectCode: string, status?: string) {
    const params = status ? `?status=${status}` : ''
    return this.request(`/api/comments/${projectCode}${params}`)
  }

  async updateCommentStatus(commentId: string, status: string) {
    return this.request(`/api/comments/${commentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    })
  }
}
```

**Validation** (`utils/validation.ts`):
```typescript
export class ValidationUtils {
  static validateProjectCode(code: string): { isValid: boolean; error?: string } {
    if (!code) {
      return { isValid: false, error: 'Le code projet est requis' }
    }

    // Format ABC-123-XYZ
    const regex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
    if (!regex.test(code)) {
      return { 
        isValid: false, 
        error: 'Format invalide. Utilisez ABC-123-XYZ' 
      }
    }

    return { isValid: true }
  }

  static sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 1000)
  }

  static formatProjectCode(input: string): string {
    // Supprimer caract�res non alphanum�riques
    let cleaned = input.replace(/[^A-Z0-9]/g, '').toUpperCase()
    
    // Limiter � 9 caract�res
    cleaned = cleaned.substring(0, 9)
    
    // Ajouter tirets automatiquement
    if (cleaned.length > 6) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
    } else if (cleaned.length > 3) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`
    }
    
    return cleaned
  }
}
```

**Popup Logic** (`popup/popup.ts`):
```typescript
import { ExtensionStorage } from '../utils/storage'
import { ApiClient } from '../utils/api'
import { ValidationUtils } from '../utils/validation'
import { ProjectData, ExtensionMessage } from '../types/extension'

class PopupController {
  private apiClient: ApiClient
  private currentProject: ProjectData | null = null
  
  // Elements DOM
  private elements = {
    disconnectedState: document.getElementById('disconnectedState') as HTMLElement,
    connectedState: document.getElementById('connectedState') as HTMLElement,
    settingsPanel: document.getElementById('settingsPanel') as HTMLElement,
    
    projectCodeInput: document.getElementById('projectCodeInput') as HTMLInputElement,
    connectBtn: document.getElementById('connectBtn') as HTMLButtonElement,
    errorMessage: document.getElementById('errorMessage') as HTMLElement,
    
    currentProjectCode: document.getElementById('currentProjectCode') as HTMLElement,
    currentProjectName: document.getElementById('currentProjectName') as HTMLElement,
    commentCount: document.getElementById('commentCount') as HTMLElement,
    
    captureBtn: document.getElementById('captureBtn') as HTMLButtonElement,
    viewCommentsBtn: document.getElementById('viewCommentsBtn') as HTMLButtonElement,
    disconnectBtn: document.getElementById('disconnectBtn') as HTMLButtonElement,
    
    settingsBtn: document.getElementById('settingsBtn') as HTMLButtonElement,
    closeSettingsBtn: document.getElementById('closeSettingsBtn') as HTMLButtonElement,
    saveSettingsBtn: document.getElementById('saveSettingsBtn') as HTMLButtonElement,
    
    commentsList: document.getElementById('commentsList') as HTMLElement
  }

  constructor() {
    this.apiClient = new ApiClient()
    this.init()
  }

  private async init() {
    await this.loadCurrentProject()
    this.setupEventListeners()
    this.updateUI()
  }

  private async loadCurrentProject() {
    this.currentProject = await ExtensionStorage.getCurrentProject()
  }

  private setupEventListeners() {
    // Code input formatting
    this.elements.projectCodeInput.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement
      const formatted = ValidationUtils.formatProjectCode(target.value)
      target.value = formatted
      this.clearError()
    })

    // Connection
    this.elements.connectBtn.addEventListener('click', () => this.handleConnect())
    this.elements.projectCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleConnect()
    })

    // Actions
    this.elements.captureBtn.addEventListener('click', () => this.handleCapture())
    this.elements.viewCommentsBtn.addEventListener('click', () => this.handleViewComments())
    this.elements.disconnectBtn.addEventListener('click', () => this.handleDisconnect())

    // Settings
    this.elements.settingsBtn.addEventListener('click', () => this.showSettings())
    this.elements.closeSettingsBtn.addEventListener('click', () => this.hideSettings())
    this.elements.saveSettingsBtn.addEventListener('click', () => this.saveSettings())
  }

  private updateUI() {
    if (this.currentProject) {
      this.showConnectedState()
    } else {
      this.showDisconnectedState()
    }
  }

  private showConnectedState() {
    this.elements.disconnectedState.classList.add('hidden')
    this.elements.connectedState.classList.remove('hidden')
    
    if (this.currentProject) {
      this.elements.currentProjectCode.textContent = this.currentProject.code
      this.elements.currentProjectName.textContent = this.currentProject.name
      this.loadRecentComments()
    }
  }

  private showDisconnectedState() {
    this.elements.connectedState.classList.add('hidden')
    this.elements.disconnectedState.classList.remove('hidden')
    this.elements.projectCodeInput.focus()
  }

  private async handleConnect() {
    const code = this.elements.projectCodeInput.value.trim()
    
    // Validation
    const validation = ValidationUtils.validateProjectCode(code)
    if (!validation.isValid) {
      this.showError(validation.error!)
      return
    }

    // UI loading
    this.setLoading(true)
    this.clearError()

    try {
      // Appel API
      const response = await this.apiClient.validateProjectCode(code)
      
      if (response.success && response.data) {
        // Sauvegarder projet
        this.currentProject = {
          id: response.data.id,
          code: response.data.code,
          name: response.data.name,
          expires_at: response.data.expires_at,
          isActive: true
        }
        
        await ExtensionStorage.setCurrentProject(this.currentProject)
        
        // Notifier content script
        await this.sendMessageToContentScript({
          type: 'UPDATE_PROJECT',
          data: this.currentProject
        })
        
        // Mettre � jour UI
        this.updateUI()
        
      } else {
        this.showError(response.error || 'Code projet invalide')
      }
    } catch (error) {
      this.showError('Erreur de connexion. V�rifiez votre internet.')
    } finally {
      this.setLoading(false)
    }
  }

  private async handleCapture() {
    try {
      // Fermer popup
      window.close()
      
      // Envoyer message au content script
      await this.sendMessageToActiveTab({
        type: 'CAPTURE_SCREENSHOT'
      })
    } catch (error) {
      console.error('Capture error:', error)
    }
  }

  private async handleViewComments() {
    if (!this.currentProject) return

    try {
      const response = await this.apiClient.getComments(this.currentProject.code)
      if (response.success && response.data) {
        // Ouvrir nouvelle page ou modal avec commentaires
        const url = `https://dashboard.visual-feedback.com/projects/${this.currentProject.code}/comments`
        chrome.tabs.create({ url })
      }
    } catch (error) {
      console.error('View comments error:', error)
    }
  }

  private async handleDisconnect() {
    await ExtensionStorage.clearCurrentProject()
    this.currentProject = null
    
    // Notifier content script
    await this.sendMessageToContentScript({
      type: 'UPDATE_PROJECT',
      data: null
    })
    
    this.updateUI()
    this.elements.projectCodeInput.value = ''
  }

  private async loadRecentComments() {
    if (!this.currentProject) return

    try {
      const response = await this.apiClient.getComments(this.currentProject.code)
      if (response.success && response.data) {
        const comments = response.data.comments.slice(0, 3) // 3 plus r�cents
        this.renderComments(comments)
        this.elements.commentCount.textContent = response.data.total.toString()
      }
    } catch (error) {
      console.error('Load comments error:', error)
    }
  }

  private renderComments(comments: any[]) {
    if (comments.length === 0) {
      this.elements.commentsList.innerHTML = `
        <div class="empty-state">
          <p>Aucun commentaire pour le moment</p>
        </div>
      `
      return
    }

    this.elements.commentsList.innerHTML = comments
      .map(comment => `
        <div class="comment-item priority-${comment.priority}">
          <div class="comment-text">${this.truncateText(comment.text, 50)}</div>
          <div class="comment-meta">
            ${this.formatDate(comment.created_at)} " ${comment.priority}
          </div>
        </div>
      `).join('')
  }

  private showSettings() {
    this.elements.settingsPanel.classList.remove('hidden')
    this.loadSettings()
  }

  private hideSettings() {
    this.elements.settingsPanel.classList.add('hidden')
  }

  private async loadSettings() {
    const settings = await ExtensionStorage.getSettings()
    
    // Charger valeurs dans formulaire
    const captureModeSelect = document.getElementById('captureModeSelect') as HTMLSelectElement
    const overlayPositionSelect = document.getElementById('overlayPositionSelect') as HTMLSelectElement
    const overlaySizeSelect = document.getElementById('overlaySizeSelect') as HTMLSelectElement
    const keyboardShortcutInput = document.getElementById('keyboardShortcutInput') as HTMLInputElement
    
    captureModeSelect.value = settings.captureMode
    overlayPositionSelect.value = settings.overlayPosition
    overlaySizeSelect.value = settings.overlaySize
    keyboardShortcutInput.value = settings.keyboardShortcut
  }

  private async saveSettings() {
    const captureModeSelect = document.getElementById('captureModeSelect') as HTMLSelectElement
    const overlayPositionSelect = document.getElementById('overlayPositionSelect') as HTMLSelectElement
    const overlaySizeSelect = document.getElementById('overlaySizeSelect') as HTMLSelectElement
    const keyboardShortcutInput = document.getElementById('keyboardShortcutInput') as HTMLInputElement
    
    const settings = {
      captureMode: captureModeSelect.value as any,
      overlayPosition: overlayPositionSelect.value as any,
      overlaySize: overlaySizeSelect.value as any,
      keyboardShortcut: keyboardShortcutInput.value
    }

    const success = await ExtensionStorage.saveSettings(settings)
    
    if (success) {
      // Notifier content script des nouveaux param�tres
      await this.sendMessageToContentScript({
        type: 'UPDATE_SETTINGS',
        data: settings
      })
      
      this.hideSettings()
    }
  }

  // Utilitaires
  private setLoading(loading: boolean) {
    this.elements.connectBtn.disabled = loading
    
    if (loading) {
      this.elements.connectBtn.querySelector('.btn-text')?.classList.add('hidden')
      this.elements.connectBtn.querySelector('.btn-loader')?.classList.remove('hidden')
    } else {
      this.elements.connectBtn.querySelector('.btn-text')?.classList.remove('hidden')
      this.elements.connectBtn.querySelector('.btn-loader')?.classList.add('hidden')
    }
  }

  private showError(message: string) {
    this.elements.errorMessage.textContent = message
    this.elements.errorMessage.classList.remove('hidden')
  }

  private clearError() {
    this.elements.errorMessage.classList.add('hidden')
  }

  private async sendMessageToActiveTab(message: ExtensionMessage) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message)
    }
  }

  private async sendMessageToContentScript(message: ExtensionMessage) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab.id) {
      chrome.tabs.sendMessage(tab.id, message)
    }
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

// Initialiser quand DOM est pr�t
document.addEventListener('DOMContentLoaded', () => {
  new PopupController()
})
```

---

### Semaine 2: Content Scripts et Capture

#### T3.4 - Content Script de Base
**Dur�e**: 5h | **Priorit�**: Haute | **D�pendances**: T3.3

**Content Script** (`content/content.ts`):
```typescript
import { ExtensionMessage, ProjectData, ExtensionSettings } from '../types/extension'

class ContentScriptController {
  private currentProject: ProjectData | null = null
  private settings: ExtensionSettings | null = null
  private overlay: HTMLElement | null = null
  private isCapturing = false
  private selectionBox: HTMLElement | null = null
  
  constructor() {
    this.init()
  }

  private async init() {
    console.log('Visual Feedback Tool: Content script loaded')
    
    // Charger donn�es depuis storage
    await this.loadStorageData()
    
    // �couter messages du popup
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
      this.handleMessage(message)
      sendResponse({ success: true })
    })
    
    // Cr�er overlay si projet connect�
    if (this.currentProject) {
      this.createOverlay()
    }
  }

  private async loadStorageData() {
    try {
      // Charger projet actuel
      const projectData = await chrome.storage.local.get('currentProject')
      this.currentProject = projectData.currentProject || null
      
      // Charger param�tres
      const settingsData = await chrome.storage.local.get('settings')
      this.settings = settingsData.settings || {
        captureMode: 'overlay',
        overlayPosition: 'top-right',
        keyboardShortcut: 'Ctrl+Shift+C',
        overlaySize: 'medium',
        apiEndpoint: 'https://visual-feedback-api.workers.dev'
      }
    } catch (error) {
      console.error('Error loading storage data:', error)
    }
  }

  private handleMessage(message: ExtensionMessage) {
    switch (message.type) {
      case 'UPDATE_PROJECT':
        this.currentProject = message.data
        if (this.currentProject) {
          this.createOverlay()
        } else {
          this.removeOverlay()
        }
        break
        
      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.data }
        this.updateOverlay()
        break
        
      case 'CAPTURE_SCREENSHOT':
        this.startCapture()
        break
        
      case 'SHOW_OVERLAY':
        this.showOverlay()
        break
        
      case 'HIDE_OVERLAY':
        this.hideOverlay()
        break
    }
  }

  private createOverlay() {
    if (this.overlay || !this.currentProject || !this.settings) return
    
    // Cr�er �l�ment overlay
    this.overlay = document.createElement('div')
    this.overlay.id = 'visual-feedback-overlay'
    this.overlay.className = `vft-overlay vft-${this.settings.overlayPosition} vft-${this.settings.overlaySize}`
    
    this.overlay.innerHTML = `
      <div class="vft-overlay-content">
        <div class="vft-icon">=%</div>
        <div class="vft-text">=�</div>
      </div>
    `
    
    // Styles
    this.addOverlayStyles()
    
    // Event listeners
    this.overlay.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.startCapture()
    })
    
    // Ajouter au DOM
    document.body.appendChild(this.overlay)
    
    // Keyboard shortcut
    if (this.settings.captureMode === 'keyboard' || this.settings.captureMode === 'both') {
      this.setupKeyboardShortcut()
    }
  }

  private addOverlayStyles() {
    if (document.getElementById('vft-overlay-styles')) return
    
    const style = document.createElement('style')
    style.id = 'vft-overlay-styles'
    style.textContent = `
      .vft-overlay {
        position: fixed;
        z-index: 2147483647;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        cursor: pointer;
        transition: all 0.3s ease;
        border: 2px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
      }
      
      .vft-overlay:hover {
        transform: scale(1.05);
        box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
      }
      
      .vft-overlay.vft-small {
        width: 50px;
        height: 50px;
      }
      
      .vft-overlay.vft-medium {
        width: 60px;
        height: 60px;
      }
      
      .vft-overlay.vft-large {
        width: 70px;
        height: 70px;
      }
      
      .vft-overlay.vft-top-right {
        top: 20px;
        right: 20px;
      }
      
      .vft-overlay.vft-bottom-right {
        bottom: 20px;
        right: 20px;
      }
      
      .vft-overlay.vft-bottom-left {
        bottom: 20px;
        left: 20px;
      }
      
      .vft-overlay-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .vft-icon {
        font-size: 16px;
        margin-bottom: 2px;
      }
      
      .vft-text {
        font-size: 12px;
      }
      
      .vft-overlay.vft-small .vft-icon {
        font-size: 14px;
      }
      
      .vft-overlay.vft-small .vft-text {
        font-size: 10px;
      }
      
      .vft-overlay.vft-large .vft-icon {
        font-size: 18px;
      }
      
      .vft-overlay.vft-large .vft-text {
        font-size: 14px;
      }
      
      /* Mode capture */
      .vft-capture-mode {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2147483646;
        pointer-events: none;
        border: 3px solid #ef4444;
        box-sizing: border-box;
      }
      
      .vft-capture-instructions {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px 30px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        text-align: center;
        z-index: 2147483648;
        pointer-events: none;
      }
      
      .vft-selection-box {
        position: absolute;
        border: 2px dashed #667eea;
        background: rgba(102, 126, 234, 0.1);
        z-index: 2147483647;
        pointer-events: none;
      }
    `
    
    document.head.appendChild(style)
  }

  private updateOverlay() {
    if (!this.overlay || !this.settings) return
    
    // Mettre � jour classes
    this.overlay.className = `vft-overlay vft-${this.settings.overlayPosition} vft-${this.settings.overlaySize}`
  }

  private removeOverlay() {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
    }
    
    // Supprimer styles si plus d'overlay
    const styles = document.getElementById('vft-overlay-styles')
    if (styles) {
      styles.remove()
    }
  }

  private showOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'block'
    }
  }

  private hideOverlay() {
    if (this.overlay) {
      this.overlay.style.display = 'none'
    }
  }

  private setupKeyboardShortcut() {
    if (!this.settings) return
    
    document.addEventListener('keydown', (e) => {
      // Parser raccourci (ex: "Ctrl+Shift+C")
      const shortcut = this.settings!.keyboardShortcut.toLowerCase()
      const keys = shortcut.split('+')
      
      let match = true
      
      if (keys.includes('ctrl') && !e.ctrlKey) match = false
      if (keys.includes('shift') && !e.shiftKey) match = false
      if (keys.includes('alt') && !e.altKey) match = false
      if (keys.includes('meta') && !e.metaKey) match = false
      
      // Derni�re touche
      const lastKey = keys[keys.length - 1]
      if (e.key.toLowerCase() !== lastKey) match = false
      
      if (match) {
        e.preventDefault()
        this.startCapture()
      }
    })
  }

  private startCapture() {
    if (this.isCapturing) return
    
    this.isCapturing = true
    this.hideOverlay()
    
    // Cr�er indicateur mode capture
    const captureMode = document.createElement('div')
    captureMode.className = 'vft-capture-mode'
    document.body.appendChild(captureMode)
    
    // Instructions
    const instructions = document.createElement('div')
    instructions.className = 'vft-capture-instructions'
    instructions.innerHTML = `
      <div style="margin-bottom: 10px;">=% Mode Capture Activ�</div>
      <div>Cliquez et glissez pour s�lectionner une zone</div>
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.8;">
        Clic droit pour capturer l'�cran entier " �chap pour annuler
      </div>
    `
    document.body.appendChild(instructions)
    
    // Event listeners pour s�lection
    let isSelecting = false
    let startX = 0
    let startY = 0
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Clic droit = �cran entier
        this.captureFullScreen()
        return
      }
      
      isSelecting = true
      startX = e.clientX
      startY = e.clientY
      
      // Cr�er box de s�lection
      this.selectionBox = document.createElement('div')
      this.selectionBox.className = 'vft-selection-box'
      this.selectionBox.style.left = startX + 'px'
      this.selectionBox.style.top = startY + 'px'
      document.body.appendChild(this.selectionBox)
    }
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isSelecting || !this.selectionBox) return
      
      const currentX = e.clientX
      const currentY = e.clientY
      
      const left = Math.min(startX, currentX)
      const top = Math.min(startY, currentY)
      const width = Math.abs(currentX - startX)
      const height = Math.abs(currentY - startY)
      
      this.selectionBox.style.left = left + 'px'
      this.selectionBox.style.top = top + 'px'
      this.selectionBox.style.width = width + 'px'
      this.selectionBox.style.height = height + 'px'
    }
    
    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting || !this.selectionBox) return
      
      const rect = this.selectionBox.getBoundingClientRect()
      
      // Nettoyer
      this.cleanupCapture()
      
      // Capturer zone s�lectionn�e
      this.captureArea({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height
      })
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cleanupCapture()
      }
    }
    
    // D�sactiver menu contextuel
    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }
    
    // Ajouter listeners
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)
    
    // Fonction cleanup
    const cleanup = () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      
      captureMode.remove()
      instructions.remove()
      
      if (this.selectionBox) {
        this.selectionBox.remove()
        this.selectionBox = null
      }
      
      this.isCapturing = false
      this.showOverlay()
    }
    
    // Stocker cleanup pour usage ult�rieur
    (window as any).vftCleanup = cleanup
  }

  private cleanupCapture() {
    if ((window as any).vftCleanup) {
      (window as any).vftCleanup()
      delete (window as any).vftCleanup
    }
  }

  private async captureFullScreen() {
    this.cleanupCapture()
    
    try {
      // Demander capture au background script
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_FULL_SCREEN'
      })
      
      if (response.success) {
        this.showCommentModal(response.screenshot, null)
      }
    } catch (error) {
      console.error('Full screen capture error:', error)
    }
  }

  private async captureArea(coordinates: { x: number; y: number; width: number; height: number }) {
    try {
      // Demander capture au background script
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_AREA',
        data: coordinates
      })
      
      if (response.success) {
        this.showCommentModal(response.screenshot, coordinates)
      }
    } catch (error) {
      console.error('Area capture error:', error)
    }
  }

  private showCommentModal(screenshot: string, coordinates: { x: number; y: number; width: number; height: number } | null) {
    // Cr�er modal de commentaire
    const modal = document.createElement('div')
    modal.id = 'vft-comment-modal'
    modal.innerHTML = `
      <div class="vft-modal-overlay">
        <div class="vft-modal-content">
          <div class="vft-modal-header">
            <h3>=� Nouveau Commentaire</h3>
            <button class="vft-close-btn"></button>
          </div>
          
          <div class="vft-modal-body">
            <div class="vft-screenshot-preview">
              <img src="${screenshot}" alt="Capture d'�cran" />
            </div>
            
            <div class="vft-comment-form">
              <textarea 
                placeholder="D�crivez le probl�me ou suggestion..."
                class="vft-comment-text"
                maxlength="1000"
              ></textarea>
              
              <div class="vft-priority-selector">
                <label>Priorit�:</label>
                <div class="vft-priority-options">
                  <input type="radio" id="vft-low" name="priority" value="low">
                  <label for="vft-low">Faible</label>
                  
                  <input type="radio" id="vft-normal" name="priority" value="normal" checked>
                  <label for="vft-normal">Normale</label>
                  
                  <input type="radio" id="vft-high" name="priority" value="high">
                  <label for="vft-high">�lev�e</label>
                </div>
              </div>
            </div>
          </div>
          
          <div class="vft-modal-footer">
            <button class="vft-cancel-btn">Annuler</button>
            <button class="vft-send-btn">Envoyer</button>
          </div>
        </div>
      </div>
    `
    
    // Styles pour la modal
    this.addModalStyles()
    
    // Event listeners
    const closeBtn = modal.querySelector('.vft-close-btn') as HTMLElement
    const cancelBtn = modal.querySelector('.vft-cancel-btn') as HTMLElement
    const sendBtn = modal.querySelector('.vft-send-btn') as HTMLElement
    const textarea = modal.querySelector('.vft-comment-text') as HTMLTextAreaElement
    
    const closeModal = () => {
      modal.remove()
      this.showOverlay()
    }
    
    closeBtn.addEventListener('click', closeModal)
    cancelBtn.addEventListener('click', closeModal)
    
    sendBtn.addEventListener('click', async () => {
      const text = textarea.value.trim()
      if (!text) {
        alert('Veuillez saisir un commentaire')
        return
      }
      
      const priority = (modal.querySelector('input[name="priority"]:checked') as HTMLInputElement).value
      
      await this.sendComment({
        text,
        priority,
        screenshot,
        coordinates
      })
      
      closeModal()
    })
    
    // Ajouter au DOM
    document.body.appendChild(modal)
    textarea.focus()
  }

  private addModalStyles() {
    if (document.getElementById('vft-modal-styles')) return
    
    const style = document.createElement('style')
    style.id = 'vft-modal-styles'
    style.textContent = `
      .vft-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      
      .vft-modal-content {
        background: white;
        border-radius: 12px;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .vft-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .vft-modal-header h3 {
        margin: 0;
        font-size: 18px;
        color: #1a1a1a;
      }
      
      .vft-close-btn {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        color: #6b7280;
      }
      
      .vft-close-btn:hover {
        background: #f3f4f6;
      }
      
      .vft-modal-body {
        padding: 20px;
        max-height: 60vh;
        overflow-y: auto;
      }
      
      .vft-screenshot-preview {
        margin-bottom: 20px;
        text-align: center;
      }
      
      .vft-screenshot-preview img {
        max-width: 100%;
        max-height: 200px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }
      
      .vft-comment-text {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        margin-bottom: 16px;
      }
      
      .vft-comment-text:focus {
        outline: none;
        border-color: #667eea;
      }
      
      .vft-priority-selector label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #374151;
      }
      
      .vft-priority-options {
        display: flex;
        gap: 16px;
      }
      
      .vft-priority-options input[type="radio"] {
        margin-right: 6px;
      }
      
      .vft-modal-footer {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        padding: 20px;
        border-top: 1px solid #e5e7eb;
      }
      
      .vft-cancel-btn,
      .vft-send-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      
      .vft-cancel-btn {
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        color: #374151;
      }
      
      .vft-cancel-btn:hover {
        background: #e5e7eb;
      }
      
      .vft-send-btn {
        background: #667eea;
        border: none;
        color: white;
      }
      
      .vft-send-btn:hover {
        background: #5a67d8;
      }
    `
    
    document.head.appendChild(style)
  }

  private async sendComment(data: {
    text: string
    priority: string
    screenshot: string
    coordinates: { x: number; y: number; width: number; height: number } | null
  }) {
    if (!this.currentProject) return
    
    try {
      const commentData = {
        project_code: this.currentProject.code,
        url: window.location.href,
        text: data.text,
        priority: data.priority,
        screenshot: data.screenshot.split(',')[1], // Retirer data:image/png;base64,
        coordinates: data.coordinates,
        metadata: {
          user_agent: navigator.userAgent,
          screen_resolution: `${window.screen.width}x${window.screen.height}`
        }
      }
      
      const response = await fetch(`${this.settings!.apiEndpoint}/api/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commentData)
      })
      
      if (response.ok) {
        // Succ�s
        this.showSuccessMessage()
      } else {
        throw new Error('Erreur serveur')
      }
    } catch (error) {
      console.error('Send comment error:', error)
      alert('Erreur lors de l\'envoi du commentaire. Veuillez r�essayer.')
    }
  }

  private showSuccessMessage() {
    const message = document.createElement('div')
    message.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 2147483647;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
      ">
         Commentaire envoy� avec succ�s !
      </div>
    `
    
    document.body.appendChild(message)
    
    setTimeout(() => {
      message.remove()
    }, 3000)
  }
}

// Initialiser content script
new ContentScriptController()
```

---

#### T3.5 - Background Script
**Dur�e**: 4h | **Priorit�**: Haute | **D�pendances**: T3.4

**Background Script** (`background/background.ts`):
```typescript
// Background script pour Manifest V3
chrome.runtime.onInstalled.addListener(() => {
  console.log('Visual Feedback Tool: Extension installed')
})

// G�rer messages des content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CAPTURE_FULL_SCREEN':
      captureFullScreen(sender.tab?.id)
        .then(screenshot => sendResponse({ success: true, screenshot }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Async response
      
    case 'CAPTURE_AREA':
      captureArea(sender.tab?.id, message.data)
        .then(screenshot => sendResponse({ success: true, screenshot }))
        .catch(error => sendResponse({ success: false, error: error.message }))
      return true // Async response
  }
})

// Capture �cran entier
async function captureFullScreen(tabId?: number): Promise<string> {
  if (!tabId) throw new Error('Tab ID required')
  
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
      format: 'png',
      quality: 90
    })
    
    return screenshot
  } catch (error) {
    throw new Error('Failed to capture screenshot')
  }
}

// Capture zone sp�cifique
async function captureArea(
  tabId: number | undefined, 
  coordinates: { x: number; y: number; width: number; height: number }
): Promise<string> {
  if (!tabId) throw new Error('Tab ID required')
  
  try {
    // Capturer l'�cran entier d'abord
    const fullScreenshot = await chrome.tabs.captureVisibleTab(undefined, {
      format: 'png',
      quality: 90
    })
    
    // Crop la zone s�lectionn�e
    const croppedScreenshot = await cropImage(fullScreenshot, coordinates)
    
    return croppedScreenshot
  } catch (error) {
    throw new Error('Failed to capture area')
  }
}

// Crop image canvas
async function cropImage(
  base64Image: string, 
  coordinates: { x: number; y: number; width: number; height: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      const canvas = new OffscreenCanvas(coordinates.width, coordinates.height)
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }
      
      // Dessiner la zone cropp�e
      ctx.drawImage(
        img,
        coordinates.x, coordinates.y, coordinates.width, coordinates.height,
        0, 0, coordinates.width, coordinates.height
      )
      
      // Convertir en blob puis base64
      canvas.convertToBlob({ type: 'image/png', quality: 0.9 })
        .then(blob => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read blob'))
          reader.readAsDataURL(blob)
        })
        .catch(reject)
    }
    
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = base64Image
  })
}

// G�rer raccourcis clavier globaux
chrome.commands.onCommand.addListener((command) => {
  if (command === 'capture-screenshot') {
    // Envoyer message au content script de l'onglet actif
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_SCREENSHOT' })
      }
    })
  }
})
```

---

### Livrables Sprint 1
- [ ] Extension Chrome installable localement
- [ ] Interface popup compl�te et fonctionnelle
- [ ] Content script avec overlay flottant
- [ ] Capture d'�cran (plein �cran + zone)
- [ ] Modal de commentaire avec preview
- [ ] Communication popup � content script � background
- [ ] Stockage local des param�tres
- [ ] Tests unitaires des composants cl�s

**Crit�res de validation**:
- Extension charge sans erreur dans Chrome
- Popup s'affiche et permet la connexion
- Overlay appara�t sur les pages web
- Capture et commentaire fonctionnent
- Donn�es sauvegard�es correctement

**Prochaines �tapes**: Connexion avec l'API backend pour validation des codes et envoi des commentaires.

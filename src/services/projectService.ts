import { 
  Project, 
  CreateProjectRequest, 
  ProjectResponse, 
  UpdateProjectRequest,
  ProjectListResponse,
  PaginationParams,
  ErrorResponse
} from '../types'
import { generateProjectCode, generateId, isValidProjectCodeFormat } from '../utils'

/**
 * Service de gestion des projets
 * Gère le CRUD des projets dans la base de données D1
 */
export class ProjectService {
  constructor(private db: D1Database) {}

  /**
   * Crée un nouveau projet
   * @param data Données du projet à créer
   * @returns Informations du projet créé
   */
  async createProject(data: CreateProjectRequest): Promise<ProjectResponse> {
    const id = generateId()
    const code = generateProjectCode()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)) // 30 jours

    try {
      const stmt = this.db.prepare(`
        INSERT INTO projects (
          id, code, name, owner_email, expires_at, max_comments, notify_email, webhook_url, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      await stmt.bind(
        id,
        code,
        data.name,
        data.owner_email,
        expiresAt.toISOString(),
        data.max_comments || 100,
        data.notify_email || false,
        data.webhook_url || null,
        'active'
      ).run()

      return {
        id,
        code,
        name: data.name,
        expires_at: expiresAt.toISOString(),
        max_comments: data.max_comments || 100
      }
    } catch (error) {
      console.error('Error creating project:', error)
      throw new Error('Failed to create project')
    }
  }

  /**
   * Récupère un projet par son code
   * @param code Code du projet
   * @returns Projet ou null si introuvable/expiré
   */
  async getProjectByCode(code: string): Promise<Project | null> {
    if (!isValidProjectCodeFormat(code)) {
      return null
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM projects WHERE code = ? AND status = "active"')
      const result = await stmt.bind(code).first()
      
      if (!result) {
        return null
      }

      const project = result as unknown as Project
      
      // Vérifier expiration
      if (new Date(project.expires_at) < new Date()) {
        await this.expireProject(code)
        return null
      }
      
      return project
    } catch (error) {
      console.error('Error getting project by code:', error)
      return null
    }
  }

  /**
   * Récupère un projet par son ID
   * @param id ID du projet
   * @returns Projet ou null si introuvable
   */
  async getProjectById(id: string): Promise<Project | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?')
      const result = await stmt.bind(id).first()
      
      return result ? result as unknown as Project : null
    } catch (error) {
      console.error('Error getting project by ID:', error)
      return null
    }
  }

  /**
   * Met à jour un projet
   * @param code Code du projet
   * @param updates Données à mettre à jour
   * @returns True si mise à jour réussie
   */
  async updateProject(code: string, updates: UpdateProjectRequest): Promise<boolean> {
    if (!isValidProjectCodeFormat(code)) {
      return false
    }

    try {
      // Construire la requête dynamiquement
      const updateFields: string[] = []
      const values: any[] = []

      if (updates.name !== undefined) {
        updateFields.push('name = ?')
        values.push(updates.name)
      }
      if (updates.max_comments !== undefined) {
        updateFields.push('max_comments = ?')
        values.push(updates.max_comments)
      }
      if (updates.notify_email !== undefined) {
        updateFields.push('notify_email = ?')
        values.push(updates.notify_email)
      }
      if (updates.webhook_url !== undefined) {
        updateFields.push('webhook_url = ?')
        values.push(updates.webhook_url)
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?')
        values.push(updates.status)
      }

      if (updateFields.length === 0) {
        return false // Rien à mettre à jour
      }

      const stmt = this.db.prepare(`
        UPDATE projects 
        SET ${updateFields.join(', ')} 
        WHERE code = ? AND status != 'expired'
      `)
      
      values.push(code)
      const result = await stmt.bind(...values).run()
      
      return result.meta.changes > 0
    } catch (error) {
      console.error('Error updating project:', error)
      return false
    }
  }

  /**
   * Expire un projet (le marque comme expiré)
   * @param code Code du projet
   */
  async expireProject(code: string): Promise<void> {
    try {
      const stmt = this.db.prepare('UPDATE projects SET status = "expired" WHERE code = ?')
      await stmt.bind(code).run()
    } catch (error) {
      console.error('Error expiring project:', error)
    }
  }

  /**
   * Supprime définitivement un projet et ses commentaires
   * @param code Code du projet
   * @returns True si suppression réussie
   */
  async deleteProject(code: string): Promise<boolean> {
    if (!isValidProjectCodeFormat(code)) {
      return false
    }

    try {
      // Utiliser une transaction pour supprimer projet et commentaires
      const deleteComments = this.db.prepare('DELETE FROM comments WHERE project_code = ?')
      const deleteProject = this.db.prepare('DELETE FROM projects WHERE code = ?')
      
      await deleteComments.bind(code).run()
      const result = await deleteProject.bind(code).run()
      
      return result.meta.changes > 0
    } catch (error) {
      console.error('Error deleting project:', error)
      return false
    }
  }

  /**
   * Liste les projets d'un propriétaire avec pagination
   * @param ownerEmail Email du propriétaire
   * @param pagination Paramètres de pagination
   * @returns Liste paginée des projets
   */
  async listProjectsByOwner(
    ownerEmail: string, 
    pagination: PaginationParams = {}
  ): Promise<ProjectListResponse> {
    const page = Math.max(1, pagination.page || 1)
    const perPage = Math.min(100, Math.max(1, pagination.per_page || 20))
    const offset = (page - 1) * perPage

    try {
      // Compter le total
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total 
        FROM projects 
        WHERE owner_email = ?
      `)
      const countResult = await countStmt.bind(ownerEmail).first()
      const total = (countResult as any)?.total || 0

      // Récupérer les projets
      let orderBy = 'created_at DESC'
      if (pagination.sort === 'name') {
        orderBy = `name ${pagination.order === 'asc' ? 'ASC' : 'DESC'}`
      } else if (pagination.sort === 'expires_at') {
        orderBy = `expires_at ${pagination.order === 'asc' ? 'ASC' : 'DESC'}`
      }

      const stmt = this.db.prepare(`
        SELECT id, code, name, expires_at, max_comments, status
        FROM projects 
        WHERE owner_email = ?
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `)

      const results = await stmt.bind(ownerEmail, perPage, offset).all()
      const projects = results.results.map(row => ({
        id: (row as any).id,
        code: (row as any).code,
        name: (row as any).name,
        expires_at: (row as any).expires_at,
        max_comments: (row as any).max_comments
      }))

      return {
        projects,
        total,
        page,
        per_page: perPage
      }
    } catch (error) {
      console.error('Error listing projects:', error)
      return {
        projects: [],
        total: 0,
        page,
        per_page: perPage
      }
    }
  }

  /**
   * Vérifie et expire automatiquement les projets expirés
   * @returns Nombre de projets expirés
   */
  async expireOldProjects(): Promise<number> {
    try {
      const now = new Date().toISOString()
      const stmt = this.db.prepare(`
        UPDATE projects 
        SET status = 'expired' 
        WHERE expires_at < ? AND status = 'active'
      `)
      
      const result = await stmt.bind(now).run()
      return result.meta.changes
    } catch (error) {
      console.error('Error expiring old projects:', error)
      return 0
    }
  }

  /**
   * Obtient les statistiques d'un projet
   * @param code Code du projet
   * @returns Statistiques du projet
   */
  async getProjectStats(code: string): Promise<{
    total_comments: number
    comments_by_status: Record<string, number>
    comments_by_priority: Record<string, number>
  } | null> {
    if (!isValidProjectCodeFormat(code)) {
      return null
    }

    try {
      // Vérifier que le projet existe
      const project = await this.getProjectByCode(code)
      if (!project) {
        return null
      }

      // Compter total commentaires
      const totalStmt = this.db.prepare(`
        SELECT COUNT(*) as total 
        FROM comments 
        WHERE project_code = ?
      `)
      const totalResult = await totalStmt.bind(code).first()
      const total_comments = (totalResult as any)?.total || 0

      // Statistiques par statut
      const statusStmt = this.db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM comments 
        WHERE project_code = ? 
        GROUP BY status
      `)
      const statusResults = await statusStmt.bind(code).all()
      const comments_by_status: Record<string, number> = {}
      statusResults.results.forEach((row: any) => {
        comments_by_status[row.status] = row.count
      })

      // Statistiques par priorité
      const priorityStmt = this.db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM comments 
        WHERE project_code = ? 
        GROUP BY priority
      `)
      const priorityResults = await priorityStmt.bind(code).all()
      const comments_by_priority: Record<string, number> = {}
      priorityResults.results.forEach((row: any) => {
        comments_by_priority[row.priority] = row.count
      })

      return {
        total_comments,
        comments_by_status,
        comments_by_priority
      }
    } catch (error) {
      console.error('Error getting project stats:', error)
      return null
    }
  }

  /**
   * Prolonge l'expiration d'un projet
   * @param code Code du projet
   * @param additionalDays Nombre de jours supplémentaires
   * @returns True si prolongation réussie
   */
  async extendProjectExpiration(code: string, additionalDays: number = 30): Promise<boolean> {
    if (!isValidProjectCodeFormat(code) || additionalDays <= 0) {
      return false
    }

    try {
      const project = await this.getProjectByCode(code)
      if (!project) {
        return false
      }

      const currentExpiry = new Date(project.expires_at)
      const newExpiry = new Date(currentExpiry.getTime() + (additionalDays * 24 * 60 * 60 * 1000))

      const stmt = this.db.prepare(`
        UPDATE projects 
        SET expires_at = ?, status = 'active'
        WHERE code = ?
      `)
      
      const result = await stmt.bind(newExpiry.toISOString(), code).run()
      return result.meta.changes > 0
    } catch (error) {
      console.error('Error extending project expiration:', error)
      return false
    }
  }
} 
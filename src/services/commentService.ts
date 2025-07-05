import { 
  Comment, 
  CreateCommentRequest, 
  CommentResponse,
  UpdateCommentRequest,
  CommentListResponse,
  CommentStatusUpdateRequest,
  Coordinates,
  FilterOptions,
  PaginationParams
} from '../types'
import { generateId, isValidProjectCodeFormat } from '../utils'

/**
 * Service de gestion des commentaires
 * Gère le CRUD des commentaires et l'upload des screenshots vers R2
 */
export class CommentService {
  constructor(private db: D1Database, private bucket: R2Bucket) {}

  /**
   * Crée un nouveau commentaire
   * @param data Données du commentaire à créer
   * @returns ID du commentaire créé
   */
  async createComment(data: CreateCommentRequest): Promise<string> {
    const id = generateId()
    let screenshotUrl: string | null = null

    try {
      // Upload screenshot si fourni
      if (data.screenshot) {
        screenshotUrl = await this.uploadScreenshot(id, data.screenshot)
      }

      const stmt = this.db.prepare(`
        INSERT INTO comments (
          id, project_code, url, text, priority, screenshot_url,
          coordinates_x, coordinates_y, coordinates_width, coordinates_height,
          user_agent, screen_resolution, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        data.metadata?.screen_resolution || null,
        'new'
      ).run()

      return id
    } catch (error) {
      console.error('Error creating comment:', error)
      
      // Nettoyer screenshot si upload a réussi mais DB a échoué
      if (screenshotUrl) {
        await this.deleteScreenshot(screenshotUrl).catch(() => {})
      }
      
      throw new Error('Failed to create comment')
    }
  }

  /**
   * Récupère les commentaires d'un projet
   * @param projectCode Code du projet
   * @param options Options de filtrage et pagination
   * @returns Liste des commentaires
   */
  async getCommentsByProject(
    projectCode: string, 
    options: FilterOptions & PaginationParams = {}
  ): Promise<CommentListResponse> {
    if (!isValidProjectCodeFormat(projectCode)) {
      return {
        comments: [],
        total: 0,
        project: { id: '', name: '', code: projectCode }
      }
    }

    try {
      // Construire les conditions WHERE
      const conditions = ['project_code = ?']
      const params = [projectCode]

      if (options.status) {
        conditions.push('status = ?')
        params.push(options.status)
      }

      if (options.priority) {
        conditions.push('priority = ?')
        params.push(options.priority)
      }

      if (options.date_from) {
        conditions.push('created_at >= ?')
        params.push(options.date_from)
      }

      if (options.date_to) {
        conditions.push('created_at <= ?')
        params.push(options.date_to)
      }

      if (options.search) {
        conditions.push('text LIKE ?')
        params.push(`%${options.search}%`)
      }

      const whereClause = conditions.join(' AND ')

      // Compter le total
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as total 
        FROM comments 
        WHERE ${whereClause}
      `)
      const countResult = await countStmt.bind(...params).first()
      const total = (countResult as any)?.total || 0

      // Récupérer les commentaires avec pagination
      const page = Math.max(1, options.page || 1)
      const perPage = Math.min(100, Math.max(1, options.per_page || 20))
      const offset = (page - 1) * perPage

      let orderBy = 'created_at DESC'
      if (options.sort === 'priority') {
        orderBy = `priority ${options.order === 'asc' ? 'ASC' : 'DESC'}, created_at DESC`
      } else if (options.sort === 'status') {
        orderBy = `status ${options.order === 'asc' ? 'ASC' : 'DESC'}, created_at DESC`
      }

      const stmt = this.db.prepare(`
        SELECT * FROM comments 
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `)

      const results = await stmt.bind(...params, perPage, offset).all()
      const comments = results.results.map(row => this.formatCommentResponse(row as any))

      // Récupérer info du projet
      const projectStmt = this.db.prepare('SELECT id, name, code FROM projects WHERE code = ?')
      const projectResult = await projectStmt.bind(projectCode).first()
      const project = projectResult ? {
        id: (projectResult as any).id,
        name: (projectResult as any).name,
        code: (projectResult as any).code
      } : { id: '', name: '', code: projectCode }

      return {
        comments,
        total,
        project
      }
    } catch (error) {
      console.error('Error getting comments by project:', error)
      return {
        comments: [],
        total: 0,
        project: { id: '', name: '', code: projectCode }
      }
    }
  }

  /**
   * Met à jour le statut d'un commentaire
   * @param id ID du commentaire
   * @param status Nouveau statut
   * @returns True si mise à jour réussie
   */
  async updateCommentStatus(
    id: string, 
    status: 'new' | 'in_progress' | 'resolved'
  ): Promise<boolean> {
    try {
      const stmt = this.db.prepare('UPDATE comments SET status = ? WHERE id = ?')
      const result = await stmt.bind(status, id).run()
      
      return result.meta.changes > 0
    } catch (error) {
      console.error('Error updating comment status:', error)
      return false
    }
  }

  /**
   * Met à jour un commentaire
   * @param id ID du commentaire
   * @param updates Données à mettre à jour
   * @returns True si mise à jour réussie
   */
  async updateComment(id: string, updates: UpdateCommentRequest): Promise<boolean> {
    try {
      const updateFields: string[] = []
      const values: any[] = []

      if (updates.text !== undefined) {
        updateFields.push('text = ?')
        values.push(updates.text)
      }
      if (updates.priority !== undefined) {
        updateFields.push('priority = ?')
        values.push(updates.priority)
      }
      if (updates.status !== undefined) {
        updateFields.push('status = ?')
        values.push(updates.status)
      }

      if (updateFields.length === 0) {
        return false
      }

      const stmt = this.db.prepare(`
        UPDATE comments 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `)
      
      values.push(id)
      const result = await stmt.bind(...values).run()
      
      return result.meta.changes > 0
    } catch (error) {
      console.error('Error updating comment:', error)
      return false
    }
  }

  /**
   * Supprime un commentaire
   * @param id ID du commentaire
   * @returns True si suppression réussie
   */
  async deleteComment(id: string): Promise<boolean> {
    try {
      // Récupérer le commentaire pour supprimer son screenshot
      const comment = await this.getCommentById(id)
      
      // Supprimer de la DB
      const stmt = this.db.prepare('DELETE FROM comments WHERE id = ?')
      const result = await stmt.bind(id).run()
      
      const success = result.meta.changes > 0
      
      // Supprimer screenshot si suppression DB réussie
      if (success && comment?.screenshot_url) {
        await this.deleteScreenshot(comment.screenshot_url).catch(() => {})
      }
      
      return success
    } catch (error) {
      console.error('Error deleting comment:', error)
      return false
    }
  }

  /**
   * Récupère un commentaire par son ID
   * @param id ID du commentaire
   * @returns Commentaire ou null
   */
  async getCommentById(id: string): Promise<Comment | null> {
    try {
      const stmt = this.db.prepare('SELECT * FROM comments WHERE id = ?')
      const result = await stmt.bind(id).first()
      
      return result ? result as unknown as Comment : null
    } catch (error) {
      console.error('Error getting comment by ID:', error)
      return null
    }
  }

  /**
   * Upload un screenshot vers R2
   * @param commentId ID du commentaire
   * @param base64Image Image en base64
   * @returns URL du screenshot
   */
  private async uploadScreenshot(commentId: string, base64Image: string): Promise<string> {
    try {
      // Décoder base64 (supprimer préfixe data:image/xxx;base64, si présent)
      const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '')
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
      
      // Générer nom de fichier avec timestamp pour éviter conflits
      const timestamp = Date.now()
      const fileName = `screenshots/${commentId}-${timestamp}.webp`
      
      // Upload vers R2
      await this.bucket.put(fileName, imageBuffer, {
        httpMetadata: {
          contentType: 'image/webp',
          cacheControl: 'public, max-age=31536000', // 1 an
          contentDisposition: 'inline'
        },
        customMetadata: {
          commentId,
          uploadedAt: new Date().toISOString()
        }
      })

      return fileName
    } catch (error) {
      console.error('Error uploading screenshot:', error)
      throw new Error('Failed to upload screenshot')
    }
  }

  /**
   * Supprime un screenshot de R2
   * @param fileName Nom du fichier à supprimer
   */
  private async deleteScreenshot(fileName: string): Promise<void> {
    try {
      await this.bucket.delete(fileName)
    } catch (error) {
      console.error('Error deleting screenshot:', error)
      // Ne pas propager l'erreur car ce n'est pas critique
    }
  }

  /**
   * Génère l'URL publique d'un screenshot
   * @param fileName Nom du fichier
   * @param baseUrl URL de base du bucket R2
   * @returns URL publique
   */
  getScreenshotUrl(fileName: string, baseUrl: string = ''): string {
    if (!fileName) return ''
    
    // Si baseUrl n'est pas fourni, retourner juste le nom du fichier
    // L'URL complète sera construite côté client
    return baseUrl ? `${baseUrl}/${fileName}` : fileName
  }

  /**
   * Formate un commentaire pour la réponse API
   * @param row Données brutes de la DB
   * @returns Commentaire formaté
   */
  private formatCommentResponse(row: any): CommentResponse {
    return {
      id: row.id,
      project_code: row.project_code,
      url: row.url,
      text: row.text,
      priority: row.priority,
      screenshot_url: row.screenshot_url,
      coordinates: (row.coordinates_x !== null && row.coordinates_y !== null) ? {
        x: row.coordinates_x,
        y: row.coordinates_y,
        width: row.coordinates_width || 0,
        height: row.coordinates_height || 0
      } : undefined,
      user_agent: row.user_agent,
      screen_resolution: row.screen_resolution,
      created_at: row.created_at,
      status: row.status
    }
  }

  /**
   * Supprime tous les commentaires d'un projet
   * @param projectCode Code du projet
   * @returns Nombre de commentaires supprimés
   */
  async deleteCommentsByProject(projectCode: string): Promise<number> {
    if (!isValidProjectCodeFormat(projectCode)) {
      return 0
    }

    try {
      // Récupérer tous les commentaires avec screenshots
      const commentsStmt = this.db.prepare(`
        SELECT id, screenshot_url 
        FROM comments 
        WHERE project_code = ? AND screenshot_url IS NOT NULL
      `)
      const commentsResult = await commentsStmt.bind(projectCode).all()
      
      // Supprimer les screenshots
      const deletePromises = commentsResult.results.map((row: any) => 
        this.deleteScreenshot(row.screenshot_url).catch(() => {})
      )
      await Promise.all(deletePromises)
      
      // Supprimer les commentaires de la DB
      const deleteStmt = this.db.prepare('DELETE FROM comments WHERE project_code = ?')
      const result = await deleteStmt.bind(projectCode).run()
      
      return result.meta.changes
    } catch (error) {
      console.error('Error deleting comments by project:', error)
      return 0
    }
  }

  /**
   * Compte les commentaires par statut pour un projet
   * @param projectCode Code du projet
   * @returns Statistiques par statut
   */
  async getCommentStatsByProject(projectCode: string): Promise<Record<string, number>> {
    if (!isValidProjectCodeFormat(projectCode)) {
      return {}
    }

    try {
      const stmt = this.db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM comments 
        WHERE project_code = ? 
        GROUP BY status
      `)
      const results = await stmt.bind(projectCode).all()
      
      const stats: Record<string, number> = {}
      results.results.forEach((row: any) => {
        stats[row.status] = row.count
      })
      
      return stats
    } catch (error) {
      console.error('Error getting comment stats:', error)
      return {}
    }
  }

  /**
   * Marque plusieurs commentaires avec un nouveau statut
   * @param commentIds IDs des commentaires
   * @param status Nouveau statut
   * @returns Nombre de commentaires mis à jour
   */
  async bulkUpdateStatus(
    commentIds: string[], 
    status: 'new' | 'in_progress' | 'resolved'
  ): Promise<number> {
    if (commentIds.length === 0) {
      return 0
    }

    try {
      const placeholders = commentIds.map(() => '?').join(',')
      const stmt = this.db.prepare(`
        UPDATE comments 
        SET status = ? 
        WHERE id IN (${placeholders})
      `)
      
      const result = await stmt.bind(status, ...commentIds).run()
      return result.meta.changes
    } catch (error) {
      console.error('Error bulk updating comment status:', error)
      return 0
    }
  }
} 
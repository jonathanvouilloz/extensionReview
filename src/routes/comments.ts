import { Hono } from 'hono'
import { CommentService } from '../services/commentService'
import { ProjectService } from '../services/projectService'
import { CreateCommentRequest } from '../types/comment'
import { Bindings } from '../types'

export const commentRoutes = new Hono<{ Bindings: Bindings }>()

// POST /api/comments - Créer un commentaire
commentRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CreateCommentRequest
    
    // Validation
    if (!body.project_code || !body.url || !body.text) {
      return c.json({ error: 'project_code, url, and text are required' }, 400)
    }

    // Validation format code projet
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(body.project_code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    // Validation URL
    try {
      new URL(body.url)
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400)
    }

    // Validation text
    if (body.text.length < 1 || body.text.length > 1000) {
      return c.json({ error: 'Text must be between 1 and 1000 characters' }, 400)
    }

    // Validation priorité
    if (body.priority && !['low', 'normal', 'high'].includes(body.priority)) {
      return c.json({ error: 'Invalid priority' }, 400)
    }

    // Vérifier que le projet existe
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
    
    if (!code || !/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    // Paramètres de requête
    const status = c.req.query('status')
    const priority = c.req.query('priority')
    const search = c.req.query('search')
    const page = parseInt(c.req.query('page') || '1')
    const per_page = parseInt(c.req.query('per_page') || '20')
    const sort = c.req.query('sort') || 'created_at'
    const orderParam = c.req.query('order') || 'desc'
    const order = (orderParam === 'asc' || orderParam === 'desc') ? orderParam : 'desc'

    // Validation paramètres
    if (status && !['new', 'in_progress', 'resolved'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    if (priority && !['low', 'normal', 'high'].includes(priority)) {
      return c.json({ error: 'Invalid priority' }, 400)
    }

    if (page < 1 || per_page < 1 || per_page > 100) {
      return c.json({ error: 'Invalid pagination parameters' }, 400)
    }

    // Vérifier que le projet existe
    const projectService = new ProjectService(c.env.DB)
    const project = await projectService.getProjectByCode(code)
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const result = await commentService.getCommentsByProject(code, {
      status,
      priority,
      search,
      page,
      per_page,
      sort,
      order
    })
    
    return c.json(result)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// PUT /api/comments/:id/status - Mettre à jour statut commentaire
commentRoutes.put('/:id/status', async (c) => {
  try {
    const id = c.req.param('id')
    const { status } = await c.req.json()
    
    if (!id) {
      return c.json({ error: 'Comment ID is required' }, 400)
    }

    if (!status || !['new', 'in_progress', 'resolved'].includes(status)) {
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

// PUT /api/comments/:id - Mettre à jour un commentaire
commentRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const updates = await c.req.json()
    
    if (!id) {
      return c.json({ error: 'Comment ID is required' }, 400)
    }

    // Validation des updates
    if (updates.text && (updates.text.length < 1 || updates.text.length > 1000)) {
      return c.json({ error: 'Text must be between 1 and 1000 characters' }, 400)
    }

    if (updates.priority && !['low', 'normal', 'high'].includes(updates.priority)) {
      return c.json({ error: 'Invalid priority' }, 400)
    }

    if (updates.status && !['new', 'in_progress', 'resolved'].includes(updates.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const success = await commentService.updateComment(id, updates)
    
    if (!success) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error updating comment:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /api/comments/:id - Récupérer un commentaire spécifique
commentRoutes.get('/comment/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    if (!id) {
      return c.json({ error: 'Comment ID is required' }, 400)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const comment = await commentService.getCommentById(id)
    
    if (!comment) {
      return c.json({ error: 'Comment not found' }, 404)
    }

    return c.json(comment)
  } catch (error) {
    console.error('Error fetching comment:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/comments/:id - Supprimer commentaire
commentRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    
    if (!id) {
      return c.json({ error: 'Comment ID is required' }, 400)
    }

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

// PUT /api/comments/bulk/status - Mettre à jour le statut de plusieurs commentaires
commentRoutes.put('/bulk/status', async (c) => {
  try {
    const { commentIds, status } = await c.req.json()
    
    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return c.json({ error: 'Comment IDs array is required' }, 400)
    }

    if (!status || !['new', 'in_progress', 'resolved'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }

    if (commentIds.length > 100) {
      return c.json({ error: 'Maximum 100 comments can be updated at once' }, 400)
    }

    const commentService = new CommentService(c.env.DB, c.env.BUCKET)
    const updatedCount = await commentService.bulkUpdateStatus(commentIds, status)
    
    return c.json({ 
      success: true, 
      updated: updatedCount,
      total: commentIds.length
    })
  } catch (error) {
    console.error('Error bulk updating comment status:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}) 
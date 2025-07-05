import { Hono } from 'hono'
import { ProjectService } from '../services/projectService'
import { CreateProjectRequest } from '../types/project'
import { Bindings } from '../types'

export const projectRoutes = new Hono<{ Bindings: Bindings }>()

// POST /api/projects - Créer un projet
projectRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json() as CreateProjectRequest
    
    // Validation
    if (!body.name || !body.owner_email) {
      return c.json({ error: 'Name and owner_email are required' }, 400)
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.owner_email)) {
      return c.json({ error: 'Invalid email format' }, 400)
    }

    // Validation name
    if (body.name.length < 2 || body.name.length > 100) {
      return c.json({ error: 'Name must be between 2 and 100 characters' }, 400)
    }

    // Validation max_comments
    if (body.max_comments && (body.max_comments < 1 || body.max_comments > 1000)) {
      return c.json({ error: 'Max comments must be between 1 and 1000' }, 400)
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

// PUT /api/projects/:code - Mettre à jour un projet
projectRoutes.put('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    const updates = await c.req.json()
    
    if (!code || !/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    // Validation des updates
    if (updates.name && (updates.name.length < 2 || updates.name.length > 100)) {
      return c.json({ error: 'Name must be between 2 and 100 characters' }, 400)
    }

    if (updates.max_comments && (updates.max_comments < 1 || updates.max_comments > 1000)) {
      return c.json({ error: 'Max comments must be between 1 and 1000' }, 400)
    }

    if (updates.status && !['active', 'inactive', 'expired'].includes(updates.status)) {
      return c.json({ error: 'Invalid status' }, 400)
    }
    
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

// GET /api/projects/:code/stats - Obtenir les statistiques d'un projet
projectRoutes.get('/:code/stats', async (c) => {
  try {
    const code = c.req.param('code')
    
    if (!code || !/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    const projectService = new ProjectService(c.env.DB)
    const stats = await projectService.getProjectStats(code)
    
    if (!stats) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json(stats)
  } catch (error) {
    console.error('Error getting project stats:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// DELETE /api/projects/:code - Supprimer un projet
projectRoutes.delete('/:code', async (c) => {
  try {
    const code = c.req.param('code')
    
    if (!code || !/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code)) {
      return c.json({ error: 'Invalid project code format' }, 400)
    }

    const projectService = new ProjectService(c.env.DB)
    const success = await projectService.deleteProject(code)
    
    if (!success) {
      return c.json({ error: 'Project not found' }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error('Error deleting project:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
}) 
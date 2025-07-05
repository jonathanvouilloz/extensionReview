import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectService } from '../../src/services/projectService'
import { CommentService } from '../../src/services/commentService'

// Mock des dépendances D1 et R2
const mockDb = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] })
    }))
  }))
} as any

const mockBucket = {
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined)
} as any

describe('Services', () => {
  let projectService: ProjectService
  let commentService: CommentService

  beforeEach(() => {
    vi.clearAllMocks()
    projectService = new ProjectService(mockDb)
    commentService = new CommentService(mockDb, mockBucket)
  })

  describe('ProjectService', () => {
    it('should create a new project service instance', () => {
      expect(projectService).toBeInstanceOf(ProjectService)
    })

    it('should be able to create a project', async () => {
      const projectData = {
        name: 'Test Project',
        owner_email: 'test@example.com',
        max_comments: 50
      }

      const result = await projectService.createProject(projectData)
      
      expect(typeof result).toBe('object')
      expect(result).toBeTruthy()
      expect(result.id).toBeTruthy()
      expect(result.code).toBeTruthy()
      expect(result.name).toBe('Test Project')
      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should validate project code format', async () => {
      const result = await projectService.getProjectByCode('invalid-code')
      expect(result).toBeNull()
    })

    it('should handle project expiration', async () => {
      await projectService.expireProject('ABC-123-XYZ')
      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE projects SET status = "expired" WHERE code = ?')
    })

    it('should extend project expiration', async () => {
      // Mock return de getProjectByCode
      const mockProject = {
        id: 'test-id',
        code: 'ABC-123-XYZ',
        name: 'Test Project',
        owner_email: 'test@example.com',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(), // +1 jour
        max_comments: 100,
        notify_email: false,
        webhook_url: undefined,
        status: 'active' as const
      }

      vi.spyOn(projectService, 'getProjectByCode').mockResolvedValue(mockProject)

      const result = await projectService.extendProjectExpiration('ABC-123-XYZ', 30)
      expect(result).toBe(true)
    })
  })

  describe('CommentService', () => {
    it('should create a new comment service instance', () => {
      expect(commentService).toBeInstanceOf(CommentService)
    })

    it('should be able to create a comment', async () => {
      const commentData = {
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com',
        text: 'Test comment',
        priority: 'normal' as const
      }

      const result = await commentService.createComment(commentData)
      
      expect(typeof result).toBe('string')
      expect(result).toBeTruthy()
      expect(mockDb.prepare).toHaveBeenCalled()
    })

    it('should validate project code format for comments', async () => {
      const result = await commentService.getCommentsByProject('invalid-code')
      expect(result.comments).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should update comment status', async () => {
      const result = await commentService.updateCommentStatus('comment-id', 'resolved')
      expect(result).toBe(true)
      expect(mockDb.prepare).toHaveBeenCalledWith('UPDATE comments SET status = ? WHERE id = ?')
    })

    it('should handle bulk status updates', async () => {
      const commentIds = ['id1', 'id2', 'id3']
      const result = await commentService.bulkUpdateStatus(commentIds, 'in_progress')
      expect(result).toBe(1) // mocked return value
    })

    it('should handle empty bulk updates', async () => {
      const result = await commentService.bulkUpdateStatus([], 'resolved')
      expect(result).toBe(0)
    })

    it('should get comment stats', async () => {
      const result = await commentService.getCommentStatsByProject('ABC-123-XYZ')
      expect(typeof result).toBe('object')
    })

    it('should handle screenshot URL generation', () => {
      const fileName = 'screenshots/test-123.webp'
      const url = commentService.getScreenshotUrl(fileName, 'https://cdn.example.com')
      expect(url).toBe('https://cdn.example.com/screenshots/test-123.webp')
    })

    it('should handle empty screenshot URL', () => {
      const url = commentService.getScreenshotUrl('', 'https://cdn.example.com')
      expect(url).toBe('')
    })
  })

  describe('Service Integration', () => {
    it('should work together for project and comment operations', async () => {
      // Test création projet
      const projectData = {
        name: 'Integration Test',
        owner_email: 'integration@example.com'
      }
      const projectResult = await projectService.createProject(projectData)
      expect(projectResult).toBeTruthy()

      // Test création commentaire 
      const commentData = {
        project_code: 'ABC-123-XYZ',
        url: 'https://example.com/page',
        text: 'Integration test comment'
      }
      const commentResult = await commentService.createComment(commentData)
      expect(commentResult).toBeTruthy()

      // Vérifier que les services sont bien intégrés
      expect(projectService).toBeTruthy()
      expect(commentService).toBeTruthy()
    })
  })
}) 
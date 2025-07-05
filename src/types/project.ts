// Types liés aux projets
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

export interface UpdateProjectRequest {
  name?: string
  max_comments?: number
  notify_email?: boolean
  webhook_url?: string
  status?: 'active' | 'inactive' | 'expired'
}

export interface ProjectListResponse {
  projects: ProjectResponse[]
  total: number
  page: number
  per_page: number
} 
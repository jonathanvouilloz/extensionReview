// Types communs pour l'API
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp?: string
}

export interface ErrorResponse {
  error: string
  code?: string
  timestamp: string
  details?: Record<string, any>
}

export interface SuccessResponse<T = any> {
  success: true
  data: T
  timestamp: string
}

export interface PaginationParams {
  page?: number
  per_page?: number
  sort?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T = any> {
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
    has_next: boolean
    has_prev: boolean
  }
}

// Types pour les filtres
export interface FilterOptions {
  status?: string
  priority?: string
  date_from?: string
  date_to?: string
  search?: string
}

// Types pour les bindings Cloudflare
export interface CloudflareBindings {
  DB: D1Database
  BUCKET: R2Bucket
  ENVIRONMENT?: string
}

// Types pour les variables d'environnement
export interface Environment {
  NODE_ENV?: 'development' | 'production' | 'test'
  API_VERSION?: string
  CORS_ORIGIN?: string
  RATE_LIMIT_MAX?: number
  RATE_LIMIT_WINDOW?: number
}

// Types pour les requêtes HTTP
export interface RequestContext {
  user_ip?: string
  user_agent?: string
  timestamp: string
  request_id?: string
}

// Types pour les webhooks
export interface WebhookPayload {
  event: 'comment.created' | 'comment.updated' | 'comment.deleted' | 'project.created' | 'project.updated'
  data: Record<string, any>
  timestamp: string
  project_code: string
}

// Types pour les validations
export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
} 
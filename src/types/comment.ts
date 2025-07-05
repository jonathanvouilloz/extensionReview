// Types liés aux commentaires
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

export interface CommentResponse {
  id: string
  project_code: string
  url: string
  text: string
  priority: 'low' | 'normal' | 'high'
  screenshot_url?: string
  coordinates?: {
    x: number
    y: number
    width: number
    height: number
  }
  user_agent?: string
  screen_resolution?: string
  created_at: string
  status: 'new' | 'in_progress' | 'resolved'
}

export interface UpdateCommentRequest {
  text?: string
  priority?: 'low' | 'normal' | 'high'
  status?: 'new' | 'in_progress' | 'resolved'
}

export interface CommentListResponse {
  comments: CommentResponse[]
  total: number
  project: {
    id: string
    name: string
    code: string
  }
}

export interface CommentStatusUpdateRequest {
  status: 'new' | 'in_progress' | 'resolved'
}

// Types pour les coordonnées
export interface Coordinates {
  x: number
  y: number
  width: number
  height: number
}

// Types pour les métadonnées
export interface CommentMetadata {
  user_agent?: string
  screen_resolution?: string
  timestamp?: string
} 
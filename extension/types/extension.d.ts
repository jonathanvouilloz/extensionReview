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
  overlayPosition: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right'
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
  type: 'CAPTURE_SCREENSHOT' | 'SAVE_COMMENT' | 'UPDATE_PROJECT' | 'SHOW_OVERLAY' | 'HIDE_OVERLAY' | 'GET_SETTINGS' | 'UPDATE_SETTINGS' | 'SCREENSHOT_CAPTURED' | 'SCREENSHOT_ERROR' | 'TAB_ACTIVATED'
  data?: any
}

// Types pour l'API
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ProjectCreateResponse {
  id: string
  code: string
  name: string
  expires_at: string
}

export interface CommentCreateResponse {
  id: string
  success: boolean
}

// Types pour les coordonnées de capture
export interface CaptureCoordinates {
  x: number
  y: number
  width: number
  height: number
}

// Types pour les événements DOM
export interface CaptureEvent {
  type: 'start' | 'move' | 'end'
  coordinates?: CaptureCoordinates
}

// Configuration de l'overlay
export interface OverlayConfig {
  position: ExtensionSettings['overlayPosition']
  size: ExtensionSettings['overlaySize']
  visible: boolean
} 
import { ProjectCreateResponse, CommentCreateResponse, ApiResponse } from '../../types/extension'

export class ApiClient {
  private static instance: ApiClient
  private baseUrl: string

  private constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  static getInstance(baseUrl: string = 'https://visual-feedback-api.workers.dev'): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(baseUrl)
    }
    return ApiClient.instance
  }

  /**
   * Mettre à jour l'URL de base de l'API
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url
  }

  /**
   * Effectuer une requête HTTP
   */
  private async request<T>(
    endpoint: string,
    options: any = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`

    const defaultOptions: any = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Visual-Feedback-Extension/1.0.0'
      }
    }

    const requestOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    }

    try {
      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text()
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText || response.statusText}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: data as T
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur réseau inconnue'
      }
    }
  }

  /**
   * Vérifier l'état de l'API
   */
  async checkHealth(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request('/health')
  }

  /**
   * Vérifier si un code projet est valide
   */
  async validateProjectCode(code: string): Promise<ApiResponse<ProjectCreateResponse>> {
    return this.request(`/api/projects/${code}`, {
      method: 'GET'
    })
  }

  /**
   * Créer un nouveau projet
   */
  async createProject(projectData: {
    name: string
    owner_email: string
    max_comments?: number
    notify_email?: boolean
    webhook_url?: string
  }): Promise<ApiResponse<ProjectCreateResponse>> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    })
  }

  /**
   * Obtenir les détails d'un projet
   */
  async getProject(code: string): Promise<ApiResponse<ProjectCreateResponse>> {
    return this.request(`/api/projects/${code}`)
  }

  /**
   * Créer un commentaire
   */
  async createComment(commentData: {
    project_code: string
    url: string
    text: string
    priority?: 'low' | 'normal' | 'high'
    screenshot?: string
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
  }): Promise<ApiResponse<CommentCreateResponse>> {
    return this.request('/api/comments', {
      method: 'POST',
      body: JSON.stringify(commentData)
    })
  }

  /**
   * Obtenir les commentaires d'un projet
   */
  async getComments(projectCode: string): Promise<ApiResponse<any[]>> {
    return this.request(`/api/projects/${projectCode}/comments`)
  }

  /**
   * Supprimer un commentaire
   */
  async deleteComment(commentId: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/api/comments/${commentId}`, {
      method: 'DELETE'
    })
  }

  /**
   * Uploader une image
   */
  async uploadImage(imageData: string, filename: string): Promise<ApiResponse<{ url: string }>> {
    // Convertir base64 en blob
    const base64Data = imageData.split(',')[1]
    if (!base64Data) {
      return { success: false, error: 'Données d\'image invalides' }
    }

    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)

    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/png' })

    const formData = new FormData()
    formData.append('image', blob, filename)

    return this.request('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {
        // Ne pas définir Content-Type pour FormData
      }
    })
  }

  /**
   * Tester la connexion à l'API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.checkHealth()
      return response.success
    } catch (error) {
      // Connexion échouée
      return false
    }
  }

  /**
   * Valider le format d'un code projet
   */
  static validateProjectCodeFormat(code: string): boolean {
    // Format: ABC-123-XYZ (3 caractères alphanumériques, tiret, 3 fois)
    const regex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
    return regex.test(code)
  }

  /**
   * Valider une URL
   */
  static validateUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Obtenir les métadonnées de l'environnement
   */
  static getEnvironmentMetadata(): {
    user_agent: string
    screen_resolution: string
    timestamp: string
    } {
    return {
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString()
    }
  }

  /**
   * Formater une erreur pour l'affichage utilisateur
   */
  static formatError(error: string): string {
    // Nettoyer les erreurs techniques pour l'utilisateur
    if (error.includes('Failed to fetch')) {
      return 'Impossible de se connecter à l\'API. Vérifiez votre connexion internet.'
    }

    if (error.includes('HTTP 404')) {
      return 'Code projet introuvable. Vérifiez le code saisi.'
    }

    if (error.includes('HTTP 400')) {
      return 'Données invalides. Vérifiez les informations saisies.'
    }

    if (error.includes('HTTP 500')) {
      return 'Erreur serveur. Veuillez réessayer dans quelques minutes.'
    }

    return error
  }
}

/**
 * Instance globale de l'API client
 */
export const apiClient = ApiClient.getInstance()

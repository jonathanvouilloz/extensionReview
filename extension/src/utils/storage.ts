import { StorageData, ExtensionSettings, ProjectData, CommentData } from '../../types/extension'

// Déclaration globale pour Chrome (sera disponible dans le contexte de l'extension)
declare const chrome: any

const DEFAULT_SETTINGS: ExtensionSettings = {
  captureMode: 'overlay',
  overlayPosition: 'top-right',
  keyboardShortcut: 'Ctrl+Shift+C',
  overlaySize: 'medium',
  apiEndpoint: 'https://visual-feedback-api.workers.dev'
}

export class StorageManager {
  private static instance: StorageManager

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager()
    }
    return StorageManager.instance
  }

  /**
   * Obtenir toutes les données de stockage
   */
  async getAll(): Promise<StorageData> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (result: { [key: string]: any }) => {
        const data: StorageData = {
          currentProject: result.currentProject || undefined,
          settings: { ...DEFAULT_SETTINGS, ...result.settings },
          recentComments: result.recentComments || []
        }
        resolve(data)
      })
    })
  }

  /**
   * Obtenir les paramètres
   */
  async getSettings(): Promise<ExtensionSettings> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result: { [key: string]: any }) => {
        const settings = { ...DEFAULT_SETTINGS, ...result.settings }
        resolve(settings)
      })
    })
  }

  /**
   * Sauvegarder les paramètres
   */
  async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const currentSettings = await this.getSettings()
    const newSettings = { ...currentSettings, ...settings }

    return new Promise((resolve) => {
      chrome.storage.local.set({ settings: newSettings }, () => {
        resolve()
      })
    })
  }

  /**
   * Obtenir le projet actuel
   */
  async getCurrentProject(): Promise<ProjectData | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['currentProject'], (result: { [key: string]: any }) => {
        resolve(result.currentProject || null)
      })
    })
  }

  /**
   * Sauvegarder le projet actuel
   */
  async setCurrentProject(project: ProjectData): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ currentProject: project }, () => {
        resolve()
      })
    })
  }

  /**
   * Supprimer le projet actuel (déconnexion)
   */
  async clearCurrentProject(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['currentProject'], () => {
        resolve()
      })
    })
  }

  /**
   * Obtenir les commentaires récents
   */
  async getRecentComments(): Promise<CommentData[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['recentComments'], (result: { [key: string]: any }) => {
        resolve(result.recentComments || [])
      })
    })
  }

  /**
   * Ajouter un commentaire récent
   */
  async addRecentComment(comment: CommentData): Promise<void> {
    const recentComments = await this.getRecentComments()

    // Ajouter en début de liste
    recentComments.unshift(comment)

    // Garder seulement les 10 plus récents
    const limitedComments = recentComments.slice(0, 10)

    return new Promise((resolve) => {
      chrome.storage.local.set({ recentComments: limitedComments }, () => {
        resolve()
      })
    })
  }

  /**
   * Vider les commentaires récents
   */
  async clearRecentComments(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['recentComments'], () => {
        resolve()
      })
    })
  }

  /**
   * Vider toutes les données
   */
  async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve()
      })
    })
  }

  /**
   * Écouter les changements de stockage
   */
  onStorageChange(callback: (changes: { [key: string]: any }) => void): void {
    chrome.storage.onChanged.addListener((changes: { [key: string]: any }, namespace: string) => {
      if (namespace === 'local') {
        callback(changes)
      }
    })
  }

  /**
   * Vérifier si un projet est expiré
   */
  isProjectExpired(project: ProjectData): boolean {
    const now = new Date()
    const expirationDate = new Date(project.expires_at)
    return now > expirationDate
  }

  /**
   * Nettoyer les données expirées
   */
  async cleanupExpiredData(): Promise<void> {
    const currentProject = await this.getCurrentProject()

    if (currentProject && this.isProjectExpired(currentProject)) {
      await this.clearCurrentProject()
    }

    // Nettoyer les commentaires de plus de 30 jours
    const recentComments = await this.getRecentComments()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const filteredComments = recentComments.filter(comment => {
      const commentDate = new Date(comment.metadata.timestamp)
      return commentDate > thirtyDaysAgo
    })

    if (filteredComments.length !== recentComments.length) {
      await this.clearRecentComments()
      for (const comment of filteredComments) {
        await this.addRecentComment(comment)
      }
    }
  }
}

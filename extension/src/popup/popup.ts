import { ProjectData, ExtensionSettings, ExtensionMessage } from '../../types/extension'
import { StorageManager } from '../utils/storage'
import { ApiClient } from '../utils/api'

// Déclaration globale pour Chrome
declare const chrome: any

/**
 * Contrôleur principal de la popup
 */
class PopupController {
  private storage: StorageManager
  private api: ApiClient
  private elements: { [key: string]: HTMLElement | null }
  private currentProject: ProjectData | null = null
  private settings: ExtensionSettings

  constructor() {
    this.storage = StorageManager.getInstance()
    this.api = ApiClient.getInstance()
    this.elements = {}
    this.settings = {
      captureMode: 'overlay',
      overlayPosition: 'top-right',
      keyboardShortcut: 'Ctrl+Shift+C',
      overlaySize: 'medium',
      apiEndpoint: 'https://visual-feedback-api.workers.dev'
    }

    this.initialize()
  }

  /**
   * Initialiser le contrôleur
   */
  private async initialize(): Promise<void> {
    try {
      // Nettoyer les données expirées
      await this.storage.cleanupExpiredData()

      // Récupérer les éléments du DOM
      this.bindElements()

      // Attacher les événements
      this.bindEvents()

      // Charger les données initiales
      await this.loadInitialData()

      // Mettre à jour l'affichage
      this.updateDisplay()
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error)
      this.showError('Erreur lors de l\'initialisation de l\'extension')
    }
  }

  /**
   * Lier les éléments du DOM
   */
  private bindElements(): void {
    // États
    this.elements.noProjectState = document.getElementById('no-project-state')
    this.elements.connectedState = document.getElementById('connected-state')
    this.elements.settingsState = document.getElementById('settings-state')

    // Formulaire de connexion
    this.elements.projectForm = document.getElementById('project-form')
    this.elements.projectCodeInput = document.getElementById('project-code')
    this.elements.connectBtn = document.getElementById('connect-btn')
    this.elements.errorMessage = document.getElementById('error-message')

    // Informations du projet
    this.elements.projectName = document.getElementById('project-name')
    this.elements.currentCode = document.getElementById('current-code')
    this.elements.expireDate = document.getElementById('expire-date')
    this.elements.disconnectBtn = document.getElementById('disconnect-btn')

    // Boutons d'action
    this.elements.captureBtn = document.getElementById('capture-btn')
    this.elements.quickCommentBtn = document.getElementById('quick-comment-btn')

    // Commentaires récents
    this.elements.commentsList = document.getElementById('comments-list')

    // Paramètres
    this.elements.settingsBtn = document.getElementById('settings-btn')
    this.elements.captureMode = document.getElementById('capture-mode')
    this.elements.overlayPosition = document.getElementById('overlay-position')
    this.elements.apiEndpoint = document.getElementById('api-endpoint')
    this.elements.saveSettingsBtn = document.getElementById('save-settings-btn')

    // Aide
    this.elements.helpBtn = document.getElementById('help-btn')
  }

  /**
   * Attacher les événements
   */
  private bindEvents(): void {
    // Connexion au projet
    this.elements.projectForm?.addEventListener('submit', (e) => this.handleProjectConnect(e))

    // Déconnexion
    this.elements.disconnectBtn?.addEventListener('click', () => this.handleDisconnect())

    // Actions principales
    this.elements.captureBtn?.addEventListener('click', () => this.handleCapture())
    this.elements.quickCommentBtn?.addEventListener('click', () => this.handleQuickComment())

    // Navigation
    this.elements.settingsBtn?.addEventListener('click', () => this.showSettings())
    this.elements.helpBtn?.addEventListener('click', () => this.showHelp())

    // Paramètres
    this.elements.saveSettingsBtn?.addEventListener('click', () => this.saveSettings())

    // Validation du code en temps réel
    this.elements.projectCodeInput?.addEventListener('input', (e) => this.handleCodeInput(e))

    // Écouter les changements de stockage
    this.storage.onStorageChange((changes) => this.handleStorageChange(changes))
  }

  /**
   * Charger les données initiales
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Charger les paramètres
      this.settings = await this.storage.getSettings()

      // Configurer l'API avec l'endpoint personnalisé
      this.api.setBaseUrl(this.settings.apiEndpoint)

      // Charger le projet actuel
      this.currentProject = await this.storage.getCurrentProject()

      // Vérifier si le projet est encore valide
      if (this.currentProject) {
        if (this.storage.isProjectExpired(this.currentProject)) {
          await this.storage.clearCurrentProject()
          this.currentProject = null
          this.showError('Votre projet a expiré. Veuillez vous reconnecter.')
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    }
  }

  /**
   * Mettre à jour l'affichage
   */
  private updateDisplay(): void {
    if (this.currentProject) {
      this.showConnectedState()
    } else {
      this.showNoProjectState()
    }

    this.updateSettingsForm()
  }

  /**
   * Afficher l'état "pas de projet"
   */
  private showNoProjectState(): void {
    this.elements.noProjectState?.classList.remove('hidden')
    this.elements.connectedState?.classList.add('hidden')
    this.elements.settingsState?.classList.add('hidden')
  }

  /**
   * Afficher l'état "connecté"
   */
  private showConnectedState(): void {
    this.elements.noProjectState?.classList.add('hidden')
    this.elements.connectedState?.classList.remove('hidden')
    this.elements.settingsState?.classList.add('hidden')

    if (this.currentProject) {
      if (this.elements.projectName) {
        this.elements.projectName.textContent = this.currentProject.name
      }
      if (this.elements.currentCode) {
        this.elements.currentCode.textContent = this.currentProject.code
      }
      if (this.elements.expireDate) {
        this.elements.expireDate.textContent = this.formatDate(this.currentProject.expires_at)
      }
    }

    this.loadRecentComments()
  }

  /**
   * Afficher les paramètres
   */
  private showSettings(): void {
    this.elements.noProjectState?.classList.add('hidden')
    this.elements.connectedState?.classList.add('hidden')
    this.elements.settingsState?.classList.remove('hidden')

    this.updateSettingsForm()
  }

  /**
   * Mettre à jour le formulaire des paramètres
   */
  private updateSettingsForm(): void {
    const captureModeSelect = this.elements.captureMode as HTMLSelectElement
    const overlayPositionSelect = this.elements.overlayPosition as HTMLSelectElement
    const apiEndpointInput = this.elements.apiEndpoint as HTMLInputElement

    captureModeSelect.value = this.settings.captureMode
    overlayPositionSelect.value = this.settings.overlayPosition
    apiEndpointInput.value = this.settings.apiEndpoint
  }

  /**
   * Gérer la connexion au projet
   */
  private async handleProjectConnect(event: Event): Promise<void> {
    event.preventDefault()

    const input = this.elements.projectCodeInput as HTMLInputElement
    const code = input.value.trim().toUpperCase()

    if (!code) {
      this.showError('Veuillez entrer un code projet')
      return
    }

    if (!ApiClient.validateProjectCodeFormat(code)) {
      this.showError('Format de code invalide. Utilisez le format ABC-123-XYZ')
      return
    }

    this.setLoading(true)
    this.clearError()

    try {
      const response = await this.api.validateProjectCode(code)

      if (response.success && response.data) {
        // Projet valide, sauvegarder
        const projectData: ProjectData = {
          id: response.data.id,
          code: response.data.code,
          name: response.data.name,
          expires_at: response.data.expires_at,
          isActive: true
        }

        await this.storage.setCurrentProject(projectData)
        this.currentProject = projectData

        // Informer le content script
        this.sendMessageToContentScript({
          type: 'UPDATE_PROJECT',
          data: projectData
        })

        this.updateDisplay()
      } else {
        this.showError(ApiClient.formatError(response.error || 'Code projet invalide'))
      }
    } catch (error) {
      console.error('Erreur lors de la validation:', error)
      this.showError('Erreur lors de la validation du code')
    } finally {
      this.setLoading(false)
    }
  }

  /**
   * Gérer la déconnexion
   */
  private async handleDisconnect(): Promise<void> {
    try {
      await this.storage.clearCurrentProject()
      this.currentProject = null

      // Informer le content script
      this.sendMessageToContentScript({
        type: 'UPDATE_PROJECT',
        data: null
      })

      this.updateDisplay()

      // Nettoyer le formulaire
      const input = this.elements.projectCodeInput as HTMLInputElement
      input.value = ''
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error)
      this.showError('Erreur lors de la déconnexion')
    }
  }

  /**
   * Gérer la capture d'écran
   */
  private async handleCapture(): Promise<void> {
    if (!this.currentProject) {
      this.showError('Aucun projet connecté')
      return
    }

    try {
      // Fermer la popup et envoyer message au content script
      this.sendMessageToContentScript({
        type: 'CAPTURE_SCREENSHOT',
        data: { projectCode: this.currentProject.code }
      })

      // Fermer la popup
      window.close()
    } catch (error) {
      console.error('Erreur lors de la capture:', error)
      this.showError('Erreur lors de la capture')
    }
  }

  /**
   * Gérer le commentaire rapide
   */
  private async handleQuickComment(): Promise<void> {
    if (!this.currentProject) {
      this.showError('Aucun projet connecté')
      return
    }

    try {
      // Envoyer message au content script pour commentaire rapide
      this.sendMessageToContentScript({
        type: 'SHOW_OVERLAY',
        data: { projectCode: this.currentProject.code, mode: 'quick' }
      })

      // Fermer la popup
      window.close()
    } catch (error) {
      console.error('Erreur lors du commentaire rapide:', error)
      this.showError('Erreur lors du commentaire rapide')
    }
  }

  /**
   * Sauvegarder les paramètres
   */
  private async saveSettings(): Promise<void> {
    try {
      const captureModeSelect = this.elements.captureMode as HTMLSelectElement
      const overlayPositionSelect = this.elements.overlayPosition as HTMLSelectElement
      const apiEndpointInput = this.elements.apiEndpoint as HTMLInputElement

      const newSettings: Partial<ExtensionSettings> = {
        captureMode: captureModeSelect.value as ExtensionSettings['captureMode'],
        overlayPosition: overlayPositionSelect.value as ExtensionSettings['overlayPosition'],
        apiEndpoint: apiEndpointInput.value.trim()
      }

      // Valider l'endpoint API
      if (newSettings.apiEndpoint && !ApiClient.validateUrl(newSettings.apiEndpoint)) {
        this.showError('URL d\'API invalide')
        return
      }

      await this.storage.setSettings(newSettings)
      this.settings = { ...this.settings, ...newSettings }

      // Mettre à jour l'API client
      if (newSettings.apiEndpoint) {
        this.api.setBaseUrl(newSettings.apiEndpoint)
      }

      // Informer le content script
      this.sendMessageToContentScript({
        type: 'UPDATE_SETTINGS',
        data: this.settings
      })

      // Retourner à l'état précédent
      this.updateDisplay()

      // Montrer un message de succès temporaire
      this.showSuccess('Paramètres sauvegardés')
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error)
      this.showError('Erreur lors de la sauvegarde des paramètres')
    }
  }

  /**
   * Gérer la saisie du code
   */
  private handleCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement
    let value = input.value.replace(/[^A-Z0-9-]/g, '').toUpperCase()

    // Formater automatiquement avec des tirets
    if (value.length > 3 && value.charAt(3) !== '-') {
      value = `${value.slice(0, 3)  }-${  value.slice(3)}`
    }
    if (value.length > 7 && value.charAt(7) !== '-') {
      value = `${value.slice(0, 7)  }-${  value.slice(7)}`
    }

    // Limiter à 11 caractères (XXX-XXX-XXX)
    if (value.length > 11) {
      value = value.slice(0, 11)
    }

    input.value = value
  }

  /**
   * Charger les commentaires récents
   */
  private async loadRecentComments(): Promise<void> {
    try {
      const comments = await this.storage.getRecentComments()

      if (comments.length === 0) {
        if (this.elements.commentsList) {
          this.elements.commentsList.innerHTML = '<p class="no-comments">Aucun commentaire récent</p>'
        }
        return
      }

      const commentsHtml = comments.map(comment => `
        <div class="comment-item">
          <div class="comment-text">${this.escapeHtml(comment.text.slice(0, 100))}${comment.text.length > 100 ? '...' : ''}</div>
          <div class="comment-meta">
            ${this.formatDate(comment.metadata.timestamp)} - 
            <a href="${comment.url}" target="_blank" rel="noopener">${this.getDomainFromUrl(comment.url)}</a>
          </div>
        </div>
      `).join('')

      if (this.elements.commentsList) {
        this.elements.commentsList.innerHTML = commentsHtml
      }
    } catch (error) {
      console.error('Erreur lors du chargement des commentaires:', error)
      if (this.elements.commentsList) {
        this.elements.commentsList.innerHTML = '<p class="error">Erreur lors du chargement</p>'
      }
    }
  }

  /**
   * Gérer les changements de stockage
   */
  private handleStorageChange(changes: { [key: string]: any }): void {
    if (changes.currentProject) {
      this.currentProject = changes.currentProject.newValue || null
      this.updateDisplay()
    }

    if (changes.settings) {
      this.settings = { ...this.settings, ...changes.settings.newValue }
      this.updateSettingsForm()
    }

    if (changes.recentComments) {
      this.loadRecentComments()
    }
  }

  /**
   * Envoyer un message au content script
   */
  private async sendMessageToContentScript(message: ExtensionMessage): Promise<void> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message)
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error)
    }
  }

  /**
   * Afficher une aide
   */
  private showHelp(): void {
    const helpUrl = 'https://github.com/visual-feedback-tool/extension#readme'
    chrome.tabs.create({ url: helpUrl })
  }

  /**
   * Définir l'état de chargement
   */
  private setLoading(loading: boolean): void {
    const connectBtn = this.elements.connectBtn as HTMLButtonElement
    const btnText = connectBtn.querySelector('.btn-text')
    const btnLoader = connectBtn.querySelector('.btn-loader')

    connectBtn.disabled = loading

    if (loading) {
      btnText?.classList.add('hidden')
      btnLoader?.classList.remove('hidden')
    } else {
      btnText?.classList.remove('hidden')
      btnLoader?.classList.add('hidden')
    }
  }

  /**
   * Afficher une erreur
   */
  private showError(message: string): void {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.textContent = message
      this.elements.errorMessage.classList.remove('hidden')
    }

    // Cacher automatiquement après 5 secondes
    setTimeout(() => {
      this.clearError()
    }, 5000)
  }

  /**
   * Effacer l'erreur
   */
  private clearError(): void {
    if (this.elements.errorMessage) {
      this.elements.errorMessage.classList.add('hidden')
      this.elements.errorMessage.textContent = ''
    }
  }

  /**
   * Afficher un message de succès
   */
  private showSuccess(message: string): void {
    // Créer un élément de succès temporaire
    const successElement = document.createElement('div')
    successElement.className = 'success-message'
    successElement.textContent = message
    successElement.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 1000;
      animation: slideInRight 0.3s ease-out;
    `

    document.body.appendChild(successElement)

    setTimeout(() => {
      successElement.remove()
    }, 3000)
  }

  /**
   * Formater une date
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * Échapper le HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Obtenir le domaine d'une URL
   */
  private getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url
    }
  }
}

// Initialiser quand le DOM est prêt
document.addEventListener('DOMContentLoaded', () => {
  new PopupController()
})

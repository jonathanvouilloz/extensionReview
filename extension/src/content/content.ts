// Content script pour l'extension Visual Feedback Tool
// Injecté sur toutes les pages web

import { ExtensionMessage, ProjectData, ExtensionSettings } from '../../types/extension'
import { ValidationUtils } from '../utils/validation'

// Déclaration globale pour Chrome
declare const chrome: any

interface CaptureArea {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Contrôleur du content script
 */
class ContentScriptController {
  private overlay: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private currentProject: ProjectData | null = null
  private settings: ExtensionSettings | null = null
  private isCapturing: boolean = false
  private captureIndicator: HTMLElement | null = null
  private selectionBox: HTMLElement | null = null
  private isDragging: boolean = false
  private dragStart: { x: number; y: number } | null = null
  private keyboardListenerAdded: boolean = false

  constructor() {
    this.initialize()
  }

  /**
   * Initialiser le content script
   */
  private async initialize(): Promise<void> {
    console.log('Visual Feedback Tool - Content script initialisé')

    // Écouter les messages du background et de la popup
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: any) => {
      this.handleMessage(message, sender, sendResponse)
      return true
    })

    // Charger les données initiales
    await this.loadInitialData()

    // Créer l'overlay si on a un projet
    if (this.currentProject) {
      this.createOverlay()
    }

    // Configurer les raccourcis clavier
    this.setupKeyboardShortcuts()
  }

  /**
   * Charger les données initiales
   */
  private async loadInitialData(): Promise<void> {
    try {
      // Demander les données au background script
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS'
      })

      if (response.success) {
        this.settings = response.data
      }

      // Récupérer le projet depuis le storage
      chrome.storage.local.get(['currentProject'], (result: any) => {
        this.currentProject = result.currentProject || null

        if (this.currentProject) {
          this.createOverlay()
        }
      })
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error)
    }
  }

  /**
   * Configurer les raccourcis clavier
   */
  private setupKeyboardShortcuts(): void {
    if (this.keyboardListenerAdded) return

    document.addEventListener('keydown', (e) => {
      if (!this.currentProject || !this.settings) return

      // Vérifier si le raccourci correspond aux paramètres
      const shortcut = this.settings.keyboardShortcut
      if (this.isShortcutPressed(e, shortcut)) {
        e.preventDefault()
        this.startCapture()
      }
    })

    this.keyboardListenerAdded = true
  }

  /**
   * Vérifier si un raccourci clavier est pressé
   */
  private isShortcutPressed(event: KeyboardEvent, shortcut: string): boolean {
    const keys = shortcut.toLowerCase().split('+')

    // Vérifier les touches modificatrices
    if (keys.includes('ctrl') && !event.ctrlKey) return false
    if (keys.includes('shift') && !event.shiftKey) return false
    if (keys.includes('alt') && !event.altKey) return false
    if (keys.includes('meta') && !event.metaKey) return false

    // Vérifier la touche principale
    const mainKey = keys[keys.length - 1]
    return event.key.toLowerCase() === mainKey
  }

  /**
   * Gérer les messages reçus
   */
  private handleMessage(message: ExtensionMessage, sender: any, sendResponse: any): void {
    console.log('Content script - Message reçu:', message.type)

    switch (message.type) {
    case 'UPDATE_PROJECT':
      this.handleProjectUpdate(message.data)
      sendResponse({ success: true })
      break

    case 'UPDATE_SETTINGS':
      this.handleSettingsUpdate(message.data)
      sendResponse({ success: true })
      break

    case 'CAPTURE_SCREENSHOT':
      this.startCapture(message.data)
      sendResponse({ success: true })
      break

    case 'SHOW_OVERLAY':
      this.showOverlay(message.data)
      sendResponse({ success: true })
      break

    case 'HIDE_OVERLAY':
      this.hideOverlay()
      sendResponse({ success: true })
      break

    case 'SCREENSHOT_CAPTURED':
      this.handleScreenshotCaptured(message.data)
      sendResponse({ success: true })
      break

    case 'SCREENSHOT_ERROR':
      this.handleScreenshotError(message.data)
      sendResponse({ success: true })
      break

    default:
      console.log('Message non géré:', message.type)
      sendResponse({ success: false, error: 'Type de message non supporté' })
    }
  }

  /**
   * Mettre à jour le projet
   */
  private handleProjectUpdate(projectData: ProjectData | null): void {
    this.currentProject = projectData

    if (projectData) {
      this.createOverlay()
    } else {
      this.removeOverlay()
    }
  }

  /**
   * Mettre à jour les paramètres
   */
  private handleSettingsUpdate(settings: ExtensionSettings): void {
    this.settings = settings

    // Recréer l'overlay avec les nouveaux paramètres
    if (this.currentProject) {
      this.removeOverlay()
      this.createOverlay()
    }
  }

  /**
   * Créer l'overlay sur la page
   */
  private createOverlay(): void {
    if (this.overlay || !this.currentProject || !this.settings) {
      return
    }

    // Créer le conteneur principal
    this.overlay = document.createElement('div')
    this.overlay.className = `visual-feedback-overlay position-${this.settings.overlayPosition} size-${this.settings.overlaySize}`

    // Créer le bouton de trigger
    const trigger = document.createElement('button')
    trigger.className = 'visual-feedback-trigger'
    trigger.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="3" width="12" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="8" cy="7" r="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M6 1h4v1H6z" fill="currentColor"/>
      </svg>
      Feedback
    `

    // Événement de clic sur le trigger
    trigger.addEventListener('click', () => {
      this.startCapture()
    })

    // Ajouter tooltip avec raccourci clavier
    trigger.title = `Prendre une capture (${this.settings.keyboardShortcut})`

    this.overlay.appendChild(trigger)
    document.body.appendChild(this.overlay)

    console.log('Overlay créé pour le projet:', this.currentProject.code)
  }

  /**
   * Supprimer l'overlay
   */
  private removeOverlay(): void {
    if (this.overlay) {
      this.overlay.remove()
      this.overlay = null
      console.log('Overlay supprimé')
    }
  }

  /**
   * Afficher l'overlay
   */
  private showOverlay(data?: any): void {
    if (this.overlay) {
      this.overlay.classList.remove('hidden')
    } else {
      this.createOverlay()
    }
  }

  /**
   * Cacher l'overlay
   */
  private hideOverlay(): void {
    if (this.overlay) {
      this.overlay.classList.add('hidden')
    }
  }

  /**
   * Démarrer la capture
   */
  private startCapture(data?: any): void {
    if (this.isCapturing || !this.currentProject || !this.settings) {
      return
    }

    console.log('Démarrage de la capture')
    this.isCapturing = true

    // Marquer l'overlay comme en mode capture
    if (this.overlay) {
      this.overlay.classList.add('capture-mode')
    }

    // Afficher l'indicateur de capture
    this.createCaptureIndicator()

    // Selon le mode de capture
    if (this.settings.captureMode === 'overlay' || this.settings.captureMode === 'both') {
      this.startAreaSelection()
    } else {
      // Capture plein écran directement
      this.captureFullScreen()
    }
  }

  /**
   * Créer l'indicateur de capture
   */
  private createCaptureIndicator(): void {
    if (this.captureIndicator) {
      this.captureIndicator.remove()
    }

    this.captureIndicator = document.createElement('div')
    this.captureIndicator.className = 'visual-feedback-capture-indicator active'

    // Instructions
    const instructions = document.createElement('div')
    instructions.className = 'capture-instructions'
    instructions.innerHTML = `
      <div class="instructions-content">
        <h3>📸 Mode Capture Activé</h3>
        <p>Cliquez et glissez pour sélectionner une zone</p>
        <p><strong>Clic droit</strong> pour capturer l'écran entier</p>
        <p><strong>Échap</strong> pour annuler</p>
      </div>
    `

    this.captureIndicator.appendChild(instructions)
    document.body.appendChild(this.captureIndicator)

    // Ajouter styles pour les instructions
    const style = document.createElement('style')
    style.textContent = `
      .capture-instructions {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 20px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 2147483647;
        text-align: center;
        pointer-events: none;
      }
      
      .instructions-content h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
      }
      
      .instructions-content p {
        margin: 8px 0;
        font-size: 14px;
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Démarrer la sélection de zone
   */
  private startAreaSelection(): void {
    let startX = 0
    let startY = 0

    // Événements de souris
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) { // Clic droit = écran entier
        this.captureFullScreen()
        return
      }

      if (e.button === 0) { // Clic gauche = sélection
        this.isDragging = true
        startX = e.clientX
        startY = e.clientY
        this.dragStart = { x: startX, y: startY }

        // Créer la box de sélection
        this.createSelectionBox(startX, startY)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging || !this.selectionBox) return

      const currentX = e.clientX
      const currentY = e.clientY

      const left = Math.min(startX, currentX)
      const top = Math.min(startY, currentY)
      const width = Math.abs(currentX - startX)
      const height = Math.abs(currentY - startY)

      this.updateSelectionBox(left, top, width, height)
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!this.isDragging || !this.selectionBox || !this.dragStart) return

      const currentX = e.clientX
      const currentY = e.clientY

      const left = Math.min(this.dragStart.x, currentX)
      const top = Math.min(this.dragStart.y, currentY)
      const width = Math.abs(currentX - this.dragStart.x)
      const height = Math.abs(currentY - this.dragStart.y)

      // Valider la sélection (minimum 20x20 pixels)
      if (width >= 20 && height >= 20) {
        this.captureArea({ x: left, y: top, width, height })
      } else {
        this.showErrorMessage('La zone sélectionnée est trop petite')
        this.cancelCapture()
      }

      this.isDragging = false
      this.dragStart = null
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cancelCapture()
      }
    }

    const handleContextMenu = (e: Event) => {
      e.preventDefault()
    }

    // Ajouter les événements
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)

    // Fonction de nettoyage
    const cleanup = () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)

      if (this.captureIndicator) {
        this.captureIndicator.remove()
        this.captureIndicator = null
      }

      if (this.selectionBox) {
        this.selectionBox.remove()
        this.selectionBox = null
      }

      this.isCapturing = false

      if (this.overlay) {
        this.overlay.classList.remove('capture-mode')
      }
    }

    // Stocker la fonction de nettoyage
    ;(window as any).vftCaptureCleanup = cleanup
  }

  /**
   * Créer la box de sélection
   */
  private createSelectionBox(x: number, y: number): void {
    if (this.selectionBox) {
      this.selectionBox.remove()
    }

    this.selectionBox = document.createElement('div')
    this.selectionBox.className = 'visual-feedback-selection'
    this.selectionBox.style.left = `${x  }px`
    this.selectionBox.style.top = `${y  }px`
    this.selectionBox.style.width = '0px'
    this.selectionBox.style.height = '0px'

    document.body.appendChild(this.selectionBox)
  }

  /**
   * Mettre à jour la box de sélection
   */
  private updateSelectionBox(x: number, y: number, width: number, height: number): void {
    if (!this.selectionBox) return

    this.selectionBox.style.left = `${x  }px`
    this.selectionBox.style.top = `${y  }px`
    this.selectionBox.style.width = `${width  }px`
    this.selectionBox.style.height = `${height  }px`
  }

  /**
   * Capturer l'écran entier
   */
  private captureFullScreen(): void {
    this.cleanupCapture()

    chrome.runtime.sendMessage({
      type: 'CAPTURE_FULL_SCREEN',
      data: {
        projectCode: this.currentProject!.code,
        url: window.location.href
      }
    })
  }

  /**
   * Capturer une zone spécifique
   */
  private captureArea(area: CaptureArea): void {
    // Valider les coordonnées
    const validation = ValidationUtils.validateCoordinates(area)
    if (!validation.isValid) {
      this.showErrorMessage(validation.error || 'Coordonnées invalides')
      this.cancelCapture()
      return
    }

    this.cleanupCapture()

    chrome.runtime.sendMessage({
      type: 'CAPTURE_AREA',
      data: {
        projectCode: this.currentProject!.code,
        url: window.location.href,
        coordinates: area
      }
    })
  }

  /**
   * Annuler la capture
   */
  private cancelCapture(): void {
    this.cleanupCapture()
    this.showErrorMessage('Capture annulée')
  }

  /**
   * Nettoyer la capture
   */
  private cleanupCapture(): void {
    if ((window as any).vftCaptureCleanup) {
      (window as any).vftCaptureCleanup()
      delete (window as any).vftCaptureCleanup
    }
  }

  /**
   * Gérer la capture d'écran réussie
   */
  private handleScreenshotCaptured(data: any): void {
    console.log('Screenshot capturé')
    this.isCapturing = false

    // Retirer le mode capture
    if (this.overlay) {
      this.overlay.classList.remove('capture-mode')
    }

    // Créer et afficher le modal de commentaire
    this.createCommentModal(data.screenshot, data)
  }

  /**
   * Gérer l'erreur de capture
   */
  private handleScreenshotError(data: any): void {
    console.error('Erreur de capture:', data.error)
    this.isCapturing = false

    // Retirer le mode capture
    if (this.overlay) {
      this.overlay.classList.remove('capture-mode')
    }

    // Afficher l'erreur
    this.showErrorMessage(data.error || 'Erreur lors de la capture')
  }

  /**
   * Créer le modal de commentaire
   */
  private createCommentModal(screenshot: string, data: any): void {
    if (this.modal) {
      this.modal.remove()
    }

    // Créer le modal
    this.modal = document.createElement('div')
    this.modal.className = 'visual-feedback-modal'

    this.modal.innerHTML = `
      <div class="visual-feedback-modal-content">
        <h3>💬 Ajouter un commentaire</h3>
        
        <div class="screenshot-preview" style="max-height: 200px; overflow: hidden; margin-bottom: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
          <img src="${screenshot}" alt="Capture d'écran" style="width: 100%; height: auto; display: block;">
        </div>
        
        <textarea 
          id="comment-text" 
          placeholder="Décrivez votre feedback, un bug, ou une suggestion d'amélioration..."
          rows="4"
          maxlength="2000"
        ></textarea>
        
        <div class="priority-selector" style="margin: 12px 0;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">Priorité:</label>
          <select id="comment-priority" style="padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: white; font-size: 14px;">
            <option value="normal">🔵 Normale</option>
            <option value="low">🟢 Faible</option>
            <option value="high">🔴 Élevée</option>
          </select>
        </div>
        
        <div class="character-counter" style="text-align: right; margin-bottom: 16px; font-size: 12px; color: #6b7280;">
          <span id="char-count">0</span>/2000 caractères
        </div>
        
        <div class="visual-feedback-modal-actions">
          <button type="button" class="secondary-btn" id="cancel-comment">Annuler</button>
          <button type="button" class="primary-btn" id="send-comment">Envoyer le feedback</button>
        </div>
      </div>
    `

    // Événements
    const cancelBtn = this.modal.querySelector('#cancel-comment') as HTMLButtonElement
    const sendBtn = this.modal.querySelector('#send-comment') as HTMLButtonElement
    const textarea = this.modal.querySelector('#comment-text') as HTMLTextAreaElement
    const charCount = this.modal.querySelector('#char-count') as HTMLSpanElement

    // Compteur de caractères
    textarea.addEventListener('input', () => {
      const count = textarea.value.length
      charCount.textContent = count.toString()

      if (count > 1800) {
        charCount.style.color = '#ef4444'
      } else {
        charCount.style.color = '#6b7280'
      }
    })

    cancelBtn.addEventListener('click', () => {
      this.closeCommentModal()
    })

    sendBtn.addEventListener('click', () => {
      this.sendComment(screenshot, data)
    })

    // Envoi avec Ctrl+Enter
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        this.sendComment(screenshot, data)
      }
    })

    // Focus automatique sur le textarea
    setTimeout(() => {
      textarea.focus()
    }, 100)

    // Fermer avec Escape
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeCommentModal()
        document.removeEventListener('keydown', handleEscape)
      }
    }
    document.addEventListener('keydown', handleEscape)

    document.body.appendChild(this.modal)
  }

  /**
   * Fermer le modal de commentaire
   */
  private closeCommentModal(): void {
    if (this.modal) {
      this.modal.remove()
      this.modal = null
    }
  }

  /**
   * Envoyer le commentaire
   */
  private async sendComment(screenshot: string, data: any): Promise<void> {
    if (!this.currentProject) {
      return
    }

    const textarea = this.modal?.querySelector('#comment-text') as HTMLTextAreaElement
    const prioritySelect = this.modal?.querySelector('#comment-priority') as HTMLSelectElement
    const sendBtn = this.modal?.querySelector('#send-comment') as HTMLButtonElement

    const text = ValidationUtils.sanitizeComment(textarea.value)
    const priority = prioritySelect.value as 'low' | 'normal' | 'high'

    if (!text) {
      this.showErrorMessage('Veuillez saisir un commentaire')
      textarea.focus()
      return
    }

    // Validation des données
    const commentData = {
      project_code: this.currentProject.code,
      url: window.location.href,
      text,
      priority,
      screenshot,
      coordinates: data.coordinates || null,
      metadata: {
        user_agent: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`,
        timestamp: new Date().toISOString()
      }
    }

    const validation = ValidationUtils.validateCommentData(commentData)
    if (!validation.isValid) {
      this.showErrorMessage(validation.errors.join(', '))
      return
    }

    // Désactiver le bouton pendant l'envoi
    sendBtn.disabled = true
    sendBtn.textContent = 'Envoi en cours...'

    try {
      // Envoyer via message au background (qui relayera vers l'API)
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_COMMENT',
        data: commentData
      })

      if (response.success) {
        this.showSuccessMessage('💬 Commentaire envoyé avec succès !')
        this.closeCommentModal()
      } else {
        this.showErrorMessage(response.error || 'Erreur lors de l\'envoi')
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du commentaire:', error)
      this.showErrorMessage('Erreur lors de l\'envoi du commentaire')
    } finally {
      // Réactiver le bouton
      sendBtn.disabled = false
      sendBtn.textContent = 'Envoyer le feedback'
    }
  }

  /**
   * Afficher un message d'erreur
   */
  private showErrorMessage(message: string): void {
    this.showToast(message, 'error')
  }

  /**
   * Afficher un message de succès
   */
  private showSuccessMessage(message: string): void {
    this.showToast(message, 'success')
  }

  /**
   * Afficher un toast
   */
  private showToast(message: string, type: 'success' | 'error'): void {
    const toast = document.createElement('div')
    toast.className = `visual-feedback-${type}`
    toast.textContent = message

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.remove()
    }, 4000)
  }
}

// Initialiser le content script quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new ContentScriptController()
  })
} else {
  new ContentScriptController()
}

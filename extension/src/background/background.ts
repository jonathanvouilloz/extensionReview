// Background script pour l'extension Visual Feedback Tool
// Service Worker Manifest V3

import { ExtensionMessage } from '../../types/extension'

// Déclaration globale pour Chrome
declare const chrome: any

/**
 * Gestionnaire du service worker background
 */
class BackgroundService {
  constructor() {
    this.initialize()
  }

  /**
   * Initialiser le service worker
   */
  private initialize(): void {
    this.setupEventListeners()
    console.log('Visual Feedback Tool - Background service démarré')
  }

  /**
   * Configurer les écouteurs d'événements
   */
  private setupEventListeners(): void {
    // Installation de l'extension
    chrome.runtime.onInstalled.addListener((details: any) => {
      this.handleInstallation(details)
    })

    // Démarrage de l'extension
    chrome.runtime.onStartup.addListener(() => {
      console.log('Extension démarrée')
    })

    // Messages entre composants
    chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: any, sendResponse: any) => {
      this.handleMessage(message, sender, sendResponse)
      return true // Garder le canal ouvert pour les réponses asynchrones
    })

    // Clic sur l'icône de l'extension
    chrome.action.onClicked.addListener((tab: any) => {
      this.handleActionClick(tab)
    })

    // Changement d'onglet
    chrome.tabs.onActivated.addListener((activeInfo: any) => {
      this.handleTabChange(activeInfo)
    })

    // Raccourcis clavier (si configurés)
    chrome.commands.onCommand.addListener((command: string) => {
      this.handleCommand(command)
    })
  }

  /**
   * Gérer l'installation de l'extension
   */
  private handleInstallation(details: any): void {
    console.log('Extension installée:', details.reason)

    if (details.reason === 'install') {
      // Première installation
      this.onFirstInstall()
    } else if (details.reason === 'update') {
      // Mise à jour
      this.onUpdate(details.previousVersion)
    }
  }

  /**
   * Première installation
   */
  private onFirstInstall(): void {
    console.log('Première installation de l\'extension')

    // Optionnel: Ouvrir une page d'accueil
    // chrome.tabs.create({
    //   url: 'https://visual-feedback-tool.com/welcome'
    // })
  }

  /**
   * Mise à jour de l'extension
   */
  private onUpdate(previousVersion: string): void {
    console.log(`Extension mise à jour de ${previousVersion} vers ${chrome.runtime.getManifest().version}`)

    // Gérer les migrations de données si nécessaire
    this.handleDataMigration(previousVersion)
  }

  /**
   * Gérer les migrations de données
   */
  private handleDataMigration(previousVersion: string): void {
    // Exemple de migration
    if (this.isVersionLowerThan(previousVersion, '1.1.0')) {
      console.log('Migration vers v1.1.0...')
      // Logique de migration
    }
  }

  /**
   * Comparer les versions
   */
  private isVersionLowerThan(version1: string, version2: string): boolean {
    const v1Parts = version1.split('.').map(Number)
    const v2Parts = version2.split('.').map(Number)

    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0
      const v2Part = v2Parts[i] || 0

      if (v1Part < v2Part) return true
      if (v1Part > v2Part) return false
    }

    return false
  }

  /**
   * Gérer les messages entre composants
   */
  private async handleMessage(message: ExtensionMessage, sender: any, sendResponse: any): Promise<void> {
    console.log('Message reçu:', message.type, message.data)

    try {
      switch (message.type) {
      case 'CAPTURE_SCREENSHOT':
        await this.handleScreenshot(message.data, sender.tab)
        sendResponse({ success: true })
        break

      case 'GET_SETTINGS':
        const settings = await this.getStoredSettings()
        sendResponse({ success: true, data: settings })
        break

      case 'UPDATE_SETTINGS':
        await this.updateSettings(message.data)
        sendResponse({ success: true })
        break

      default:
        console.log('Type de message non géré:', message.type)
        sendResponse({ success: false, error: 'Type de message non supporté' })
      }
    } catch (error) {
      console.error('Erreur lors du traitement du message:', error)
      sendResponse({ success: false, error: 'Erreur interne' })
    }
  }

  /**
   * Gérer la capture d'écran
   */
  private async handleScreenshot(data: any, tab: any): Promise<void> {
    try {
      // Capturer l'onglet visible
      const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 90
      })

      // Envoyer le screenshot au content script
      chrome.tabs.sendMessage(tab.id, {
        type: 'SCREENSHOT_CAPTURED',
        data: { screenshot, ...data }
      })
    } catch (error) {
      console.error('Erreur lors de la capture:', error)

      // Envoyer l'erreur au content script
      chrome.tabs.sendMessage(tab.id, {
        type: 'SCREENSHOT_ERROR',
        data: { error: 'Impossible de capturer l\'écran' }
      })
    }
  }

  /**
   * Obtenir les paramètres stockés
   */
  private async getStoredSettings(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['settings'], (result: any) => {
        resolve(result.settings || {})
      })
    })
  }

  /**
   * Mettre à jour les paramètres
   */
  private async updateSettings(settings: any): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.set({ settings }, () => {
        resolve()
      })
    })
  }

  /**
   * Gérer le clic sur l'icône de l'extension
   */
  private handleActionClick(tab: any): void {
    console.log('Icône cliquée, onglet:', tab.id)

    // La popup s'ouvre automatiquement, pas d'action supplémentaire nécessaire
    // Mais on pourrait envoyer un message au content script si besoin
  }

  /**
   * Gérer le changement d'onglet
   */
  private handleTabChange(activeInfo: any): void {
    console.log('Onglet changé:', activeInfo.tabId)

    // Optionnel: Notifier le content script du changement d'onglet
    chrome.tabs.sendMessage(activeInfo.tabId, {
      type: 'TAB_ACTIVATED',
      data: { tabId: activeInfo.tabId }
    }).catch(() => {
      // Ignorer les erreurs si le content script n'est pas présent
    })
  }

  /**
   * Gérer les commandes clavier
   */
  private async handleCommand(command: string): Promise<void> {
    console.log('Commande reçue:', command)

    if (command === 'capture-screenshot') {
      // Obtenir l'onglet actif
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })

      if (tabs[0]) {
        // Envoyer message au content script pour démarrer la capture
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CAPTURE_SCREENSHOT',
          data: { source: 'keyboard' }
        })
      }
    }
  }

  /**
   * Nettoyer les données périodiquement
   */
  async cleanupData(): Promise<void> {
    try {
      // Nettoyer les données expirées
      const result = await chrome.storage.local.get(['recentComments', 'currentProject'])

      // Nettoyer les commentaires de plus de 30 jours
      if (result.recentComments) {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const filteredComments = result.recentComments.filter((comment: any) => {
          const commentDate = new Date(comment.metadata.timestamp)
          return commentDate > thirtyDaysAgo
        })

        if (filteredComments.length !== result.recentComments.length) {
          await chrome.storage.local.set({ recentComments: filteredComments })
          console.log('Commentaires expirés nettoyés')
        }
      }

      // Vérifier l'expiration du projet
      if (result.currentProject) {
        const expirationDate = new Date(result.currentProject.expires_at)
        const now = new Date()

        if (now > expirationDate) {
          await chrome.storage.local.remove(['currentProject'])
          console.log('Projet expiré supprimé')
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage:', error)
    }
  }
}

// Initialiser le service background
const backgroundService = new BackgroundService()

// Nettoyer les données toutes les heures
setInterval(() => {
  backgroundService.cleanupData()
}, 60 * 60 * 1000)

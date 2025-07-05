/**
 * Utilitaires de validation pour l'extension Visual Feedback
 */
export class ValidationUtils {
  /**
   * Valider un code projet
   */
  static validateProjectCode(code: string): { isValid: boolean; error?: string } {
    if (!code) {
      return { isValid: false, error: 'Le code projet est requis' }
    }

    // Format ABC-123-XYZ
    const regex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
    if (!regex.test(code)) {
      return {
        isValid: false,
        error: 'Format invalide. Utilisez ABC-123-XYZ'
      }
    }

    return { isValid: true }
  }

  /**
   * Valider une adresse email
   */
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    if (!email) {
      return { isValid: false, error: 'L\'adresse email est requise' }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        error: 'Format d\'email invalide'
      }
    }

    return { isValid: true }
  }

  /**
   * Valider une URL
   */
  static validateUrl(url: string): { isValid: boolean; error?: string } {
    if (!url) {
      return { isValid: false, error: 'L\'URL est requise' }
    }

    try {
      new URL(url)
      return { isValid: true }
    } catch {
      return {
        isValid: false,
        error: 'Format d\'URL invalide'
      }
    }
  }

  /**
   * Sanitiser un input utilisateur
   */
  static sanitizeInput(input: string): string {
    if (!input) return ''

    return input
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 1000)
  }

  /**
   * Sanitiser un texte de commentaire
   */
  static sanitizeComment(comment: string): string {
    if (!comment) return ''

    return comment
      .trim()
      .replace(/[<>]/g, '')
      .substring(0, 2000) // Limite plus élevée pour les commentaires
  }

  /**
   * Formater automatiquement un code projet
   */
  static formatProjectCode(input: string): string {
    if (!input) return ''

    // Supprimer caractères non alphanumérique et convertir en majuscules
    let cleaned = input.replace(/[^A-Z0-9]/g, '').toUpperCase()

    // Limiter à 9 caractères
    cleaned = cleaned.substring(0, 9)

    // Ajouter tirets automatiquement
    if (cleaned.length > 6) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3, 6)}-${cleaned.substring(6)}`
    } else if (cleaned.length > 3) {
      return `${cleaned.substring(0, 3)}-${cleaned.substring(3)}`
    }

    return cleaned
  }

  /**
   * Valider les données d'un commentaire
   */
  static validateCommentData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!data.project_code) {
      errors.push('Le code projet est requis')
    } else if (!this.validateProjectCode(data.project_code).isValid) {
      errors.push('Format de code projet invalide')
    }

    if (!data.url) {
      errors.push('L\'URL est requise')
    } else if (!this.validateUrl(data.url).isValid) {
      errors.push('Format d\'URL invalide')
    }

    if (!data.text || data.text.trim().length === 0) {
      errors.push('Le texte du commentaire est requis')
    }

    if (data.text && data.text.length > 2000) {
      errors.push('Le commentaire est trop long (maximum 2000 caractères)')
    }

    if (data.priority && !['low', 'normal', 'high'].includes(data.priority)) {
      errors.push('Priorité invalide')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Valider les paramètres d'extension
   */
  static validateExtensionSettings(settings: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (settings.captureMode && !['overlay', 'keyboard', 'both'].includes(settings.captureMode)) {
      errors.push('Mode de capture invalide')
    }

    if (settings.overlayPosition && !['top-right', 'bottom-right', 'bottom-left'].includes(settings.overlayPosition)) {
      errors.push('Position d\'overlay invalide')
    }

    if (settings.overlaySize && !['small', 'medium', 'large'].includes(settings.overlaySize)) {
      errors.push('Taille d\'overlay invalide')
    }

    if (settings.apiEndpoint && !this.validateUrl(settings.apiEndpoint).isValid) {
      errors.push('URL d\'API invalide')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Valider les coordonnées de capture
   */
  static validateCoordinates(coordinates: any): { isValid: boolean; error?: string } {
    if (!coordinates) {
      return { isValid: true } // Optionnel
    }

    const { x, y, width, height } = coordinates

    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof width !== 'number' || typeof height !== 'number') {
      return {
        isValid: false,
        error: 'Coordonnées invalides'
      }
    }

    if (x < 0 || y < 0 || width <= 0 || height <= 0) {
      return {
        isValid: false,
        error: 'Valeurs de coordonnées invalides'
      }
    }

    return { isValid: true }
  }

  /**
   * Valider les données d'image base64
   */
  static validateBase64Image(base64: string): { isValid: boolean; error?: string } {
    if (!base64) {
      return { isValid: false, error: 'Données d\'image manquantes' }
    }

    const base64Regex = /^data:image\/(png|jpg|jpeg|webp);base64,/
    if (!base64Regex.test(base64)) {
      return {
        isValid: false,
        error: 'Format d\'image invalide'
      }
    }

    // Vérifier la taille (limite à 5MB)
    const sizeInBytes = (base64.length * 3) / 4
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (sizeInBytes > maxSize) {
      return {
        isValid: false,
        error: 'Image trop volumineuse (maximum 5MB)'
      }
    }

    return { isValid: true }
  }

  /**
   * Échapper les caractères HTML
   */
  static escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * Valider un raccourci clavier
   */
  static validateKeyboardShortcut(shortcut: string): { isValid: boolean; error?: string } {
    if (!shortcut) {
      return { isValid: false, error: 'Raccourci clavier requis' }
    }

    const validKeys = /^(Ctrl|Alt|Shift|Meta)\+.*[A-Z]$/
    if (!validKeys.test(shortcut)) {
      return {
        isValid: false,
        error: 'Format de raccourci invalide (ex: Ctrl+Shift+C)'
      }
    }

    return { isValid: true }
  }

  /**
   * Nettoyer et valider un nom de projet
   */
  static validateProjectName(name: string): { isValid: boolean; error?: string; sanitized?: string } {
    if (!name) {
      return { isValid: false, error: 'Le nom du projet est requis' }
    }

    const sanitized = this.sanitizeInput(name)

    if (sanitized.length < 2) {
      return {
        isValid: false,
        error: 'Le nom du projet doit contenir au moins 2 caractères'
      }
    }

    if (sanitized.length > 100) {
      return {
        isValid: false,
        error: 'Le nom du projet ne peut pas dépasser 100 caractères'
      }
    }

    return {
      isValid: true,
      sanitized
    }
  }
}

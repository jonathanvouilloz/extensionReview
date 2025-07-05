export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateProjectCode(code: string): boolean {
  const codeRegex = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/
  return codeRegex.test(code)
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Supprimer balises
    .trim()
    .substring(0, 1000) // Limiter longueur
}

export function validateCommentData(data: any): string[] {
  const errors: string[] = []

  if (!data.project_code || !validateProjectCode(data.project_code)) {
    errors.push('Invalid project code')
  }

  if (!data.url || !validateUrl(data.url)) {
    errors.push('Invalid URL')
  }

  if (!data.text || data.text.trim().length === 0) {
    errors.push('Comment text is required')
  }

  if (data.text && data.text.length > 1000) {
    errors.push('Comment text too long (max 1000 characters)')
  }

  if (data.priority && !['low', 'normal', 'high'].includes(data.priority)) {
    errors.push('Invalid priority')
  }

  return errors
}

// Validation avancée pour les projets
export function validateProjectData(data: any): string[] {
  const errors: string[] = []

  if (!data.name || typeof data.name !== 'string') {
    errors.push('Project name is required and must be a string')
  } else if (data.name.length < 2 || data.name.length > 100) {
    errors.push('Project name must be between 2 and 100 characters')
  }

  if (!data.owner_email || !validateEmail(data.owner_email)) {
    errors.push('Valid owner email is required')
  }

  if (data.max_comments && (typeof data.max_comments !== 'number' || data.max_comments < 1 || data.max_comments > 1000)) {
    errors.push('Max comments must be a number between 1 and 1000')
  }

  if (data.notify_email && typeof data.notify_email !== 'boolean') {
    errors.push('Notify email must be a boolean')
  }

  if (data.webhook_url && (!validateUrl(data.webhook_url) || !data.webhook_url.startsWith('https://'))) {
    errors.push('Webhook URL must be a valid HTTPS URL')
  }

  return errors
}

// Validation des paramètres de requête
export function validatePaginationParams(page: any, per_page: any): string[] {
  const errors: string[] = []

  const pageNum = parseInt(page)
  const perPageNum = parseInt(per_page)

  if (isNaN(pageNum) || pageNum < 1) {
    errors.push('Page must be a positive integer')
  }

  if (isNaN(perPageNum) || perPageNum < 1 || perPageNum > 100) {
    errors.push('Per page must be between 1 and 100')
  }

  return errors
}

// Validation des statuts
export function validateStatus(status: string, allowedStatuses: string[]): boolean {
  return allowedStatuses.includes(status)
}

// Sécurisation des données contre XSS
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

// Validation des coordonnées de screenshot
export function validateCoordinates(coordinates: any): boolean {
  if (!coordinates || typeof coordinates !== 'object') {
    return false
  }

  const { x, y, width, height } = coordinates
  
  return (
    typeof x === 'number' && x >= 0 &&
    typeof y === 'number' && y >= 0 &&
    typeof width === 'number' && width > 0 &&
    typeof height === 'number' && height > 0
  )
}

// Validation des métadonnées
export function validateMetadata(metadata: any): string[] {
  const errors: string[] = []

  if (!metadata || typeof metadata !== 'object') {
    return errors
  }

  if (metadata.user_agent && typeof metadata.user_agent !== 'string') {
    errors.push('User agent must be a string')
  }

  if (metadata.screen_resolution && typeof metadata.screen_resolution !== 'string') {
    errors.push('Screen resolution must be a string')
  }

  if (metadata.user_agent && metadata.user_agent.length > 500) {
    errors.push('User agent too long (max 500 characters)')
  }

  if (metadata.screen_resolution && !/^\d+x\d+$/.test(metadata.screen_resolution)) {
    errors.push('Screen resolution must be in format WIDTHxHEIGHT')
  }

  return errors
}

// Validation des fichiers uploadés
export function validateFileUpload(file: any): string[] {
  const errors: string[] = []

  if (!file) {
    errors.push('File is required')
    return errors
  }

  // Types de fichiers autorisés pour les screenshots
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
  
  if (!allowedTypes.includes(file.type)) {
    errors.push('File type must be PNG, JPEG, or WebP')
  }

  // Taille maximale : 5MB
  if (file.size > 5 * 1024 * 1024) {
    errors.push('File size must be less than 5MB')
  }

  return errors
}

// Validation des données base64
export function validateBase64Image(base64: string): boolean {
  if (!base64 || typeof base64 !== 'string') {
    return false
  }

  // Vérifier format base64 d'image
  const base64Regex = /^data:image\/(png|jpeg|jpg|webp);base64,/
  
  if (!base64Regex.test(base64)) {
    return false
  }

  // Vérifier taille (approximative)
  const sizeInBytes = (base64.length * 3) / 4
  return sizeInBytes <= 5 * 1024 * 1024 // 5MB max
} 
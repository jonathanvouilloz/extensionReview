// Setup global pour les tests

// Polyfills pour l'environnement de test si nécessaire
import { beforeAll, afterAll } from 'vitest'

beforeAll(() => {
  // Configuration globale avant tous les tests
  
  // S'assurer que crypto est disponible (généralement disponible dans Node.js 15+)
  if (!globalThis.crypto) {
    const { webcrypto } = require('node:crypto')
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      writable: false,
      configurable: false
    })
  }
  
  // Configuration console pour les tests
  const originalConsole = console.error
  console.error = (...args) => {
    // Filtrer certains warnings pendant les tests
    const message = args[0]
    if (typeof message === 'string' && message.includes('warning')) {
      return
    }
    originalConsole(...args)
  }
})

afterAll(() => {
  // Nettoyage après tous les tests
}) 
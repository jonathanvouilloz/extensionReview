module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    webextensions: true
  },
  extends: [
    'eslint:recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
      rules: {
    // Style et formatage
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'comma-dangle': ['error', 'never'],
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    
    // Variables
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    
    // Bonnes pratiques pour les extensions
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    
    // Imports
    'no-duplicate-imports': 'error'
  },
    ignorePatterns: [
      'dist/',
      'node_modules/',
      'coverage/',
      '*.config.js'
    ]
  }
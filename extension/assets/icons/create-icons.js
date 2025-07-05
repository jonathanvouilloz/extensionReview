// Script pour créer les icônes de base de l'extension
// Exécuter avec: node create-icons.js

const fs = require('fs')
const path = require('path')

// SVG de base pour l'icône (feedback/commentaire)
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Fond circulaire -->
  <circle cx="64" cy="64" r="56" fill="url(#grad)" stroke="#ffffff" stroke-width="4"/>
  
  <!-- Icône commentaire -->
  <rect x="32" y="40" width="64" height="40" rx="8" fill="#ffffff" opacity="0.9"/>
  <rect x="36" y="44" width="56" height="4" rx="2" fill="#667eea"/>
  <rect x="36" y="52" width="48" height="3" rx="1.5" fill="#667eea" opacity="0.7"/>
  <rect x="36" y="58" width="40" height="3" rx="1.5" fill="#667eea" opacity="0.7"/>
  
  <!-- Bulle de dialogue -->
  <polygon points="48,80 56,88 64,80" fill="#ffffff" opacity="0.9"/>
  
  <!-- Point d'exclamation (feedback) -->
  <circle cx="88" cy="48" r="8" fill="#ff6b6b"/>
  <rect x="86" y="44" width="4" height="6" fill="#ffffff"/>
  <circle cx="88" cy="52" r="1.5" fill="#ffffff"/>
</svg>
`

// Fonction pour créer les icônes PNG (nécessiterait une lib comme sharp en production)
function createIcons() {
  console.log('📝 Création des icônes pour l\'extension...')
  
  // Pour l'instant, créer les fichiers SVG
  const sizes = [16, 48, 128]
  
  sizes.forEach(size => {
    const filename = `icon${size}.svg`
    const filepath = path.join(__dirname, filename)
    
    const sizedSvg = iconSvg.replace('viewBox="0 0 128 128"', `viewBox="0 0 128 128" width="${size}" height="${size}"`)
    
    fs.writeFileSync(filepath, sizedSvg)
    console.log(`✅ Créé: ${filename}`)
  })
  
  // Instructions pour conversion en PNG
  console.log('\n📋 Instructions pour finaliser les icônes:')
  console.log('1. Installer un convertisseur SVG vers PNG:')
  console.log('   npm install -g svg2png-cli')
  console.log('   # ou utiliser un service en ligne')
  console.log('')
  console.log('2. Convertir les SVG en PNG:')
  sizes.forEach(size => {
    console.log(`   svg2png icon${size}.svg icon${size}.png --width=${size} --height=${size}`)
  })
  console.log('')
  console.log('3. Ou créer manuellement avec un éditeur d\'images')
  console.log('   - Couleurs: Dégradé #667eea vers #764ba2')
  console.log('   - Fond: Transparent ou blanc')
  console.log('   - Style: Moderne, minimaliste')
}

// README pour les icônes
const readme = `# Icônes Extension Visual Feedback Tool

## Fichiers requis
- icon16.png (16x16) - Barre d'outils
- icon48.png (48x48) - Extensions et apps
- icon128.png (128x128) - Chrome Web Store

## Design Guidelines
- **Couleurs principales**: #667eea (bleu), #764ba2 (violet)
- **Style**: Moderne, flat design avec légères ombres
- **Thème**: Icône de commentaire/feedback avec point d'exclamation
- **Fond**: Transparent recommandé

## Outils recommandés
- Figma, Sketch, Adobe Illustrator
- Canva (templates disponibles)
- GIMP (gratuit)

## Alternatives rapides
Si pas d'outils de design, utiliser:
1. https://favicon.io/favicon-generator/
2. https://realfavicongenerator.net/
3. https://www.canva.com/create/logos/

## Validation
- Tester les icônes sur fond clair et foncé
- Vérifier la lisibilité aux différentes tailles
- S'assurer que l'icône est reconnaissable même à 16px
`

const readmePath = path.join(__dirname, 'README.md')
fs.writeFileSync(readmePath, readme)

if (require.main === module) {
  createIcons()
} 
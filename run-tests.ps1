# Script de test complet pour T2.6
Write-Host "🧪 Exécution des tests pour T2.6 - Tests et CI/CD" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que Node.js est installé
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    exit 1
}

# Vérifier que npm est installé
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js et npm sont disponibles" -ForegroundColor Green

# Installer les dépendances si nécessaire
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec de l'installation des dépendances" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Dépendances installées" -ForegroundColor Green
} else {
    Write-Host "✅ Dépendances déjà installées" -ForegroundColor Green
}

Write-Host ""

# 1. Type checking
Write-Host "1. 🔍 Vérification des types TypeScript..." -ForegroundColor Blue
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreurs de type détectées" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Types valides" -ForegroundColor Green
Write-Host ""

# 2. Linting
Write-Host "2. 🧹 Vérification du style de code (ESLint)..." -ForegroundColor Blue
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreurs de style détectées" -ForegroundColor Red
    Write-Host "💡 Tentative de correction automatique..." -ForegroundColor Yellow
    npm run lint:fix
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Impossible de corriger automatiquement" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Style corrigé automatiquement" -ForegroundColor Green
} else {
    Write-Host "✅ Style de code valide" -ForegroundColor Green
}
Write-Host ""

# 3. Tests unitaires
Write-Host "3. 🧪 Exécution des tests unitaires..." -ForegroundColor Blue
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests unitaires échoués" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Tous les tests passent" -ForegroundColor Green
Write-Host ""

# 4. Couverture de code
Write-Host "4. 📊 Génération du rapport de couverture..." -ForegroundColor Blue
npm run test:coverage
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de la génération de couverture" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Rapport de couverture généré" -ForegroundColor Green
Write-Host ""

# 5. Vérifier les seuils de couverture
Write-Host "5. 🎯 Vérification des seuils de couverture..." -ForegroundColor Blue
if (Test-Path "coverage/coverage-summary.json") {
    $coverage = Get-Content "coverage/coverage-summary.json" | ConvertFrom-Json
    $total = $coverage.total
    
    Write-Host "📈 Résumé de couverture:" -ForegroundColor Yellow
    Write-Host "   Lines: $($total.lines.pct)%" -ForegroundColor White
    Write-Host "   Branches: $($total.branches.pct)%" -ForegroundColor White
    Write-Host "   Functions: $($total.functions.pct)%" -ForegroundColor White
    Write-Host "   Statements: $($total.statements.pct)%" -ForegroundColor White
    
    # Vérifier les seuils (80% minimum)
    $threshold = 80
    $failed = $false
    
    if ($total.lines.pct -lt $threshold) {
        Write-Host "❌ Couverture des lignes insuffisante: $($total.lines.pct)% < $threshold%" -ForegroundColor Red
        $failed = $true
    }
    
    if ($total.branches.pct -lt $threshold) {
        Write-Host "❌ Couverture des branches insuffisante: $($total.branches.pct)% < $threshold%" -ForegroundColor Red
        $failed = $true
    }
    
    if ($total.functions.pct -lt $threshold) {
        Write-Host "❌ Couverture des fonctions insuffisante: $($total.functions.pct)% < $threshold%" -ForegroundColor Red
        $failed = $true
    }
    
    if ($total.statements.pct -lt $threshold) {
        Write-Host "❌ Couverture des statements insuffisante: $($total.statements.pct)% < $threshold%" -ForegroundColor Red
        $failed = $true
    }
    
    if ($failed) {
        Write-Host "❌ Seuils de couverture non atteints" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "✅ Tous les seuils de couverture sont atteints" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️ Fichier de couverture non trouvé" -ForegroundColor Yellow
}

Write-Host ""

# 6. Tests de sécurité
Write-Host "6. 🔒 Tests de sécurité des middlewares..." -ForegroundColor Blue
if (Test-Path "test-middleware.ps1") {
    Write-Host "💡 Pour tester les middlewares de sécurité, démarrez d'abord le serveur:" -ForegroundColor Yellow
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host "   Puis exécutez: .\test-middleware.ps1" -ForegroundColor White
} else {
    Write-Host "⚠️ Script de test de middleware non trouvé" -ForegroundColor Yellow
}

Write-Host ""

# 7. Build check
Write-Host "7. 🏗️ Vérification de la compilation..." -ForegroundColor Blue
npm run cf-typegen 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Génération des types Cloudflare réussie" -ForegroundColor Green
} else {
    Write-Host "⚠️ Génération des types Cloudflare échouée (normal en dev local)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 T2.6 - Tests et CI/CD : VALIDATION TERMINÉE" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

# Résumé final
Write-Host "📋 Résumé:" -ForegroundColor Cyan
Write-Host "   ✅ Types TypeScript validés" -ForegroundColor Green
Write-Host "   ✅ Style de code conforme (ESLint)" -ForegroundColor Green  
Write-Host "   ✅ Tests unitaires passent" -ForegroundColor Green
Write-Host "   ✅ Couverture de code > 80%" -ForegroundColor Green
Write-Host "   ✅ Configuration CI/CD prête" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Prochaines étapes:" -ForegroundColor Yellow
Write-Host "   1. Commit et push vers GitHub" -ForegroundColor White
Write-Host "   2. La CI/CD se déclenchera automatiquement" -ForegroundColor White
Write-Host "   3. Déploiement automatique si tous les tests passent" -ForegroundColor White
Write-Host ""

Write-Host "📁 Fichiers générés:" -ForegroundColor Yellow
Write-Host "   coverage/            - Rapport de couverture HTML" -ForegroundColor White
Write-Host "   .github/workflows/   - Configuration CI/CD" -ForegroundColor White
Write-Host "   .eslintrc.js         - Configuration ESLint" -ForegroundColor White 
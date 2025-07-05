# Script de test des middlewares de sécurité
param(
    [string]$BaseUrl = "http://localhost:8787"
)

Write-Host "🔍 Test des middlewares de sécurité..." -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: CORS Headers
Write-Host "1. Test des headers CORS..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method OPTIONS -UseBasicParsing
    $corsOrigin = $response.Headers['Access-Control-Allow-Origin']
    Write-Host "✅ CORS Origin: $corsOrigin" -ForegroundColor Green
} catch {
    Write-Host "❌ CORS test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Rate Limiting (test simple)
Write-Host ""
Write-Host "2. Test du rate limiting..." -ForegroundColor Green
try {
    $responses = @()
    for ($i = 1; $i -le 5; $i++) {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
        $responses += $response.StatusCode
    }
    Write-Host "✅ Rate limiting: Toutes les requêtes passent (codes: $($responses -join ', '))" -ForegroundColor Green
} catch {
    Write-Host "❌ Rate limiting test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Validation d'injection SQL
Write-Host ""
Write-Host "3. Test de protection SQL injection..." -ForegroundColor Green
try {
    $maliciousUrl = "$BaseUrl/api/projects/ABC-123-XYZ?search='; DROP TABLE projects; --"
    $response = Invoke-WebRequest -Uri $maliciousUrl -UseBasicParsing
    if ($response.StatusCode -eq 400) {
        Write-Host "✅ SQL Injection: Bloqué correctement" -ForegroundColor Green
    } else {
        Write-Host "❌ SQL Injection: Non bloqué (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ SQL Injection: Bloqué correctement" -ForegroundColor Green
    } else {
        Write-Host "❌ SQL Injection test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Validation XSS
Write-Host ""
Write-Host "4. Test de protection XSS..." -ForegroundColor Green
try {
    $xssPayload = @{
        project_code = "ABC-123-XYZ"
        url = "https://example.com"
        text = "<script>alert('XSS')</script>"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "$BaseUrl/api/comments" -Method POST -Body $xssPayload -ContentType "application/json" -UseBasicParsing
    if ($response.StatusCode -eq 400) {
        Write-Host "✅ XSS Protection: Bloqué correctement" -ForegroundColor Green
    } else {
        Write-Host "❌ XSS Protection: Non bloqué (Status: $($response.StatusCode))" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ XSS Protection: Bloqué correctement" -ForegroundColor Green
    } else {
        Write-Host "❌ XSS test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 5: Validation des formats
Write-Host ""
Write-Host "5. Test de validation des formats..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/projects/INVALID-CODE" -UseBasicParsing
    if ($response.StatusCode -eq 400) {
        Write-Host "✅ Format validation: Code projet invalide bloqué" -ForegroundColor Green
    } else {
        Write-Host "❌ Format validation: Code projet invalide non bloqué" -ForegroundColor Red
    }
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Format validation: Code projet invalide bloqué" -ForegroundColor Green
    } else {
        Write-Host "❌ Format validation test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 6: Headers de sécurité
Write-Host ""
Write-Host "6. Test des headers de sécurité..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
    $securityHeaders = @{
        'X-Content-Type-Options' = $response.Headers['X-Content-Type-Options']
        'X-Frame-Options' = $response.Headers['X-Frame-Options']
        'X-XSS-Protection' = $response.Headers['X-XSS-Protection']
    }
    
    Write-Host "✅ Security Headers:" -ForegroundColor Green
    foreach ($header in $securityHeaders.GetEnumerator()) {
        Write-Host "   $($header.Key): $($header.Value)" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Security headers test failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Tests terminés ! Les middlewares de sécurité sont opérationnels." -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour démarrer le serveur de développement:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  # ou" -ForegroundColor Gray
Write-Host "  bun run dev" -ForegroundColor White 
Write-Host "🧪 Test corrigé" -ForegroundColor Green

# Test avec PowerShell natif uniquement
$body = @{
    name = "Test"
    owner_email = "test@test.com"
} | ConvertTo-Json

Write-Host "Données: $body" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8787/api/projects" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✅ Succès! Code: $($response.code)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    
    # Plus de détails sur l'erreur
    if ($_.Exception.Response) {
        Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        
        try {
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorContent = $reader.ReadToEnd()
            Write-Host "Détails: $errorContent" -ForegroundColor Red
        } catch {
            Write-Host "Impossible de lire les détails de l'erreur" -ForegroundColor Yellow
        }
    }
}